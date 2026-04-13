from django.test import TestCase, Client
from .models import Column, Swimlane, Task
import json

class KanbanLogicTest(TestCase):
    def setUp(self):
        # Przygotowanie danych testowych
        self.c1 = Column.objects.create(title="To do", order=0)
        self.c2 = Column.objects.create(title="In Progress", order=1)
        self.swim1 = Swimlane.objects.create(name="Backend", order=0)
        self.swim2 = Swimlane.objects.create(name="Frontend", order=1)
        self.task = Task.objects.create(
            content="Test Task", 
            column=self.c1, 
            swimlane=self.swim1
        )
        self.client = Client()

    # Testy dla kolumn

    def test_add_column(self):
        """Test dodawania nowej kolumny"""
        response = self.client.post('/columns/add/', data=json.dumps({
            'title': 'Testing',
            'limit': 10
        }), content_type='application/json')
        
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Column.objects.filter(title='Testing').exists())

    def test_delete_column_reassigns_tasks_to_first_column(self):
        """Test: po usunięciu kolumny zadania trafiają do pierwszej dostępnej kolumny"""
        # 1. Tworzymy kolumnę do usunięcia
        to_delete_col = Column.objects.create(title="Do usunięcia", order=2)
        
        # 2. Zadanie przypisane do kolumny do usunięcia
        task_del = Task.objects.create(content="Uratuj mnie", column=to_delete_col)
        
        # 3. Wywołujemy usuwanie przez Client (symulacja żądania HTTP)
        # Upewnij się, że URL jest poprawny zgodnie z Twoim urls.py
        response = self.client.delete(f'/columns/{to_delete_col.id}/delete/')
        
        # Jeśli Twój widok zwraca 200 lub 204
        self.assertIn(response.status_code, [200, 204])

        # 4. KLUCZOWE: Odświeżamy obiekt z bazy danych
        task_del.refresh_from_db()
        
        # 5. Sprawdzamy nową kolumnę
        self.assertEqual(task_del.column.id, self.c1.id)
        
        # 6. Sprawdzamy, czy stara kolumna faktycznie zniknęła
        self.assertFalse(Column.objects.filter(id=to_delete_col.id).exists())

    def test_edit_column_limit_and_title(self):
        """Test edycji właściwości kolumny"""
        response = self.client.patch(f'/columns/{self.c1.id}/update/', data=json.dumps({
            'title': 'New Name',
            'limit': 20
        }), content_type='application/json')
        
        self.c1.refresh_from_db()
        self.assertEqual(self.c1.title, 'New Name')
        self.assertEqual(self.c1.limit, 20)

    def test_move_column_order(self):
        """Test zmiany kolejności kolumn"""
        # Zamieniamy kolejność c1 i c2
        payload = [
            {'id': self.c1.id, 'order': 1},
            {'id': self.c2.id, 'order': 0}
        ]

        # 2. Wysłanie żądania POST z JSONem
        response = self.client.post(
            '/columns/reorder/', 
            data=json.dumps(payload),
            content_type='application/json'
        )

        # 3. Sprawdzenie odpowiedzi serwera
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'order updated')

        # 4. Odświeżenie obiektów z bazy danych i weryfikacja
        self.c1.refresh_from_db()
        self.c2.refresh_from_db()

        self.assertEqual(self.c1.order, 1)
        self.assertEqual(self.c2.order, 0)



    def test_swimlane_deletion_migrates_tasks(self):
        """Testuje, czy po usunięciu wiersza zadania trafiają do innego wiersza"""
        response = self.client.delete(f'/swimlanes/{self.swim1.id}/delete/')
        
        # Sprawdzenie statusu odpowiedzi
        self.assertEqual(response.status_code, 200)
        
        # Odświeżenie zadania z bazy danych
        self.task.refresh_from_db()
        
        # Zadanie powinno teraz należeć do swim2 (bo swim1 usunięto)
        self.assertEqual(self.task.swimlane.id, self.swim2.id)
        self.assertFalse(Swimlane.objects.filter(id=self.swim1.id).exists())

    def test_cannot_delete_last_swimlane(self):
        """Testuje blokadę usunięcia ostatniego wiersza na tablicy"""
        self.swim2.delete() # Zostaje tylko jeden wiersz
        
        response = self.client.delete(f'/swimlanes/{self.swim1.id}/delete/')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Swimlane.objects.filter(id=self.swim1.id).exists())