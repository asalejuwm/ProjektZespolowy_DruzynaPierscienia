import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from .models import Column, Task, Swimlane, UserProfile, Subtask
from unittest.mock import patch
import logging

class KanbanFullViewsTest(TestCase):
    def setUp(self):
        self.client = Client()
        # Podstawowa struktura
        self.col1 = Column.objects.create(title="To do", order=0, limit=2)
        self.col2 = Column.objects.create(title="Done", order=1)
        self.swim1 = Swimlane.objects.create(name="Backend", order=0)
        self.swim2 = Swimlane.objects.create(name="Frontend", order=1)
        
        # Użytkownik i profil
        self.user = User.objects.create_user(username="dev_user", password="pass")
        self.profile = UserProfile.objects.create(user=self.user, task_limit=1, color="#ff0000")
        
        # Zadanie testowe
        self.task = Task.objects.create(
            content="Initial Task", 
            column=self.col1, 
            swimlane=self.swim1, 
            order=0
        )

        self.subtask = Subtask.objects.create(content="Initial Subtask", task=self.task, is_completed=False)

        self.assertEqual(str(self.col1), "To do") # Test __str__ metody modelu Column
        self.assertEqual(str(self.task), "Initial Task") # Test __str__ metody modelu Task
        self.assertEqual(str(self.subtask), "Initial Subtask") # Test __str__ metody modelu Subtask
        pr = f"Profile of {self.user.username}"
        self.assertEqual(str(self.profile), pr) # Test __str__ metody modelu UserProfile

    # --- 1. GŁÓWNY WIDOK ---
    def test_tasks_get_all_data(self):
        """Test pobierania pełnej struktury tablicy"""
        response = self.client.get('/tasks/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('columns', data)
        self.assertIn('tasks', data)
        self.assertEqual(len(data['tasks']), 1)

    # --- 2. OPERACJE NA ZADANIACH ---
    def test_add_task_with_subtasks(self):
        """Test dodawania zadania i automatycznej generacji subtasków"""
        payload = {"content": "New", "column_id": self.col1.id, "swimlane_id": self.swim1.id}
        response = self.client.post('/tasks/add/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()['subtasks']), 4) # Research, Implementation itd.


    def test_add_task_wrong_method(self):
        """Test dodawania zadania inną metodą niż POST"""
        payload = {"content": "Invalid", "column_id": self.col1.id, "swimlane_id": self.swim1.id}
        response = self.client.get('/tasks/add/')
        self.assertEqual(response.status_code, 405) # Method Not Allowed


    def test_move_task_position(self):
        """Test zmiany kolejności i komórki zadania"""
        payload = {"column_id": self.col2.id, "swimlane_id": self.swim1.id, "position": 0}
        response = self.client.patch(f'/tasks/{self.task.id}/move/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.column_id, self.col2.id)
    
    def test_move_task_wrong_method(self):
        """Test zmiany kolejności zadania inną metodą niż PATCH"""
        payload = {"column_id": self.col2.id, "swimlane_id": self.swim1.id, "position": 0}
        response = self.client.post(f'/tasks/{self.task.id}/move/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 405) # Method Not Allowed


    def test_update_task_content_and_limit(self):
        """Test edycji treści i walidacji limitu przypisań"""
        # Najpierw przypisujemy jedno zadanie (limit użytkownika to 1)
        self.task.assignees.add(self.user)
        # Próba przypisania tego samego użytkownika do innego zadania
        task2 = Task.objects.create(content="Task 2", column=self.col1, swimlane=self.swim1)
        payload = {"assignee_ids": [self.user.id], "content": "Updated Content"}
        response = self.client.patch(f'/tasks/{task2.id}/update/', data=json.dumps(payload), content_type='application/json') 
        self.assertEqual(response.status_code, 400) # Oczekiwany błąd limitu

    def test_update_task_completion_status(self):
        """Testuje aktualizację statusu ukończenia zadania (is_completed)"""
        # 1. Tworzymy zadanie, które domyślnie ma is_completed = False
        task = Task.objects.create(
            content="Zadanie do ukończenia", 
            column=self.col1, 
            swimlane=self.swim1
        )
        
        # 2. Przygotowujemy dane do aktualizacji
        payload = {"is_completed": True}
        
        # 3. Wysyłamy PATCH do odpowiedniego URL (zgodnie z urls.py)
        # path('tasks/<int:task_id>/update/', update_task)
        response = self.client.patch(
            f'/tasks/{task.id}/update/', 
            data=json.dumps(payload), 
            content_type='application/json'
        )

        # 4. Sprawdzamy czy API odpowiedziało sukcesem
        self.assertEqual(response.status_code, 200)

        # 5. Odświeżamy obiekt z bazy danych i sprawdzamy zmianę
        task.refresh_from_db()
        self.assertTrue(task.is_completed)
    
    def test_update_task_assignees(self):
        """Testuje przypisanie użytkowników do zadania (task.assignees.set)"""
        # 1. Przygotowujemy zadanie i dwóch użytkowników
        task = Task.objects.create(content="Zadanie do przypisania", column=self.col1, swimlane=self.swim1)
        user2 = User.objects.create_user(username="user2", password="password")
        
        # Upewniamy się, że użytkownicy mają profile (wymagane przez logikę limitów w views.py)
        UserProfile.objects.get_or_create(user=user2)
        
        # 2. Dane do wysłania - chcemy przypisać obu użytkowników (self.user z setUp oraz user2)
        payload = {
            "assignee_ids": [self.user.id, user2.id]
        }
        
        # 3. Wysyłamy PATCH
        response = self.client.patch(
            f'/tasks/{task.id}/update/', 
            data=json.dumps(payload), 
            content_type='application/json'
        )

        # 4. Sprawdzamy status odpowiedzi
        self.assertEqual(response.status_code, 200)

        # 5. Weryfikujemy w bazie danych
        task.refresh_from_db()
        assigned_ids = list(task.assignees.values_list('id', flat=True))
        
        self.assertIn(self.user.id, assigned_ids)
        self.assertIn(user2.id, assigned_ids)
        self.assertEqual(len(assigned_ids), 2)

    def test_update_task_not_found(self):
        """Testuje sytuację, gdy zadanie o podanym ID nie istnieje"""
        # Wysyłamy PATCH do ID, którego nie ma (np. 99999)
        response = self.client.patch(
            '/tasks/99999/update/', 
            data=json.dumps({"content": "New content"}), 
            content_type='application/json'
        )
        
        # Sprawdzamy czy zwrócono 404 i odpowiedni komunikat
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error'], "Task not found")




    def test_update_task_wrong_method(self):
        """Test edycji zadania inną metodą niż PATCH"""
        payload = {"content": "Invalid Update"}
        response = self.client.post(f'/tasks/{self.task.id}/update/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 405) # Method Not Allowed

    def test_update_task_internal_server_error(self):
        """Testuje ogólny wyjątek Exception (Błąd 500) bez crashowania mechanizmu logów"""
        task = Task.objects.create(content="Original", column=self.col1, swimlane=self.swim1)
    
        # Wyłączamy logowanie błędów, aby Django nie próbowało renderować tracebacku
        logging.disable(logging.CRITICAL)
    
        try:
            with patch('kanban.models.Task.save') as mocked_save:
                mocked_save.side_effect = Exception("Sztuczny błąd")
            
                response = self.client.patch(
                    f'/tasks/{task.id}/update/', 
                    data=json.dumps({"content": "Nowa treść"}), 
                    content_type='application/json'
                )
            
                self.assertEqual(response.status_code, 500)
                self.assertIn("Sztuczny błąd", response.json()['error'])
        finally:
            # Przywracamy logowanie po teście
            logging.disable(logging.NOTSET)



    def test_delete_task(self):
        """Test usuwania zadania"""
        response = self.client.delete(f'/tasks/{self.task.id}/delete/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Task.objects.filter(id=self.task.id).exists())

    def test_delete_task_not_found(self):
        """Test usuwania nieistniejącego zadania"""
        response = self.client.delete('/tasks/99999/delete/')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error'], "Task does not exist")

    def test_delete_task_wrong_method(self):
        """Test usuwania zadania inną metodą niż DELETE"""
        response = self.client.post(f'/tasks/{self.task.id}/delete/')
        self.assertEqual(response.status_code, 405) # Method Not Allowed



    # --- 3. OPERACJE NA KOLUMNACH ---
    def test_add_column_validation(self):
        """Test dodawania kolumny i walidacji duplikatów"""
        payload = {"title": "To do"} # Istnieje już w setUp
        response = self.client.post('/columns/add/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_add_column_success(self):
        """Test poprawnego utworzenia kolumny z kompletem danych."""
        data = {
            'title': 'Nowa Kolumna',
            'limit': 10,
            'header_color': '#ff0000',
            'bg_color': '#eeeeee'
        }
        
        response = self.client.post(
            '/columns/add/', 
            data=json.dumps(data), 
            content_type='application/json'
        )

        

        # Sprawdzenie statusu
        self.assertEqual(response.status_code, 201)
        
        # Sprawdzenie bazy danych
        self.assertEqual(Column.objects.count(), 3)
        new_col = Column.objects.last()
        self.assertEqual(new_col.title, 'Nowa Kolumna')
        self.assertEqual(new_col.order, 2) # Pierwsza kolumna powinna mieć order 1

        # Sprawdzenie odpowiedzi JSON
        response_data = response.json()
        self.assertEqual(response_data['title'], 'Nowa Kolumna')
        self.assertEqual(response_data['limit'], 10)

    def test_add_column_default_values(self):
        """Test sprawdzający, czy wartości domyślne są poprawnie ustawiane."""
        data = {'title': 'Tylko Tytuł'}
        
        response = self.client.post(
            '/columns/add/', 
            data=json.dumps(data), 
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 201)
        new_col = Column.objects.get(title='Tylko Tytuł')
        
        # Sprawdzenie domyślnych wartości z Twojego kodu
        self.assertEqual(new_col.limit, 5)
        self.assertEqual(new_col.header_color, '#c7ddff')
        self.assertEqual(new_col.bg_color, '#ffffff')

    def test_add_column_incrementing_order(self):
        """Test sprawdzający logikę max_order + 1."""
        # Tworzymy istniejącą kolumnę
        Column.objects.create(title='Istniejąca', order=5)

        data = {'title': 'Kolejna'}
        response = self.client.post(
            '/columns/add/', 
            data=json.dumps(data), 
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 201)
        new_col = Column.objects.get(title='Kolejna')
        
        # Powinno być 5 + 1 = 6
        self.assertEqual(new_col.order, 6)

    def test_add_column_wrong_method(self):
        """Test blokowania metod innych niż POST."""
        response = self.client.get('/columns/add/')
        self.assertEqual(response.status_code, 405)
    

    def test_delete_column_and_move_tasks(self):
        """Test przenoszenia zadań do innej kolumny przy usuwaniu"""
        response = self.client.delete(f'/columns/{self.col1.id}/delete/')
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.column_id, self.col2.id) # Trafiło do col2

    def test_delete_column_not_found(self):
        """Testuje sytuację, gdy kolumna o podanym ID nie istnieje"""
        # Wysyłamy DELETE do ID, którego nie ma (np. 99999)
        response = self.client.delete(
            '/columns/99999/delete/'
        )
        
        # Sprawdzamy czy zwrócono 404 i odpowiedni komunikat
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error'], "Column not found")


    def test_delete_column_wrong_method(self):
        """Test blokowania metod innych niż DELETE."""
        response = self.client.get(f'/columns/{self.col1.id}/delete/')
        self.assertEqual(response.status_code, 405)


    def test_update_column_settings(self):
        """Test zmiany ustawień kolumny (kolory, limit)"""
        payload = {"limit": 10,"title": "Updated Title", "header_color": "#000000", "bg_color": "#ffffff"   }
        response = self.client.patch(f'/columns/{self.col1.id}/update/', data=json.dumps(payload), content_type='application/json')
        self.col1.refresh_from_db()
        self.assertEqual(self.col1.limit, 10)
        self.assertEqual(self.col1.title, "Updated Title")
        self.assertEqual(self.col1.header_color, "#000000")
        self.assertEqual(self.col1.bg_color, "#ffffff")

    def test_update_column_not_found(self):
        """Testuje sytuację, gdy kolumna o podanym ID nie istnieje"""
        # Wysyłamy PATCH do ID, którego nie ma (np. 99999)
        response = self.client.patch(
            '/columns/99999/update/',
            data=json.dumps({"title": "Updated Title"}),
            content_type='application/json'
        )
        
        # Sprawdzamy czy zwrócono 404 i odpowiedni komunikat
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error'], "Column not found")

    def test_update_column_wrong_method(self):
        """Test blokowania metod innych niż PATCH."""
        response = self.client.post(f'/columns/{self.col1.id}/update/', data=json.dumps({"title": "Invalid"}), content_type='application/json')
        self.assertEqual(response.status_code, 405)


    def test_update_column_order(self):
        """Test zmiany kolejności kolumn"""
        payload = [{"id": self.col1.id, "order": 5}, {"id": self.col2.id, "order": 1}]
        response = self.client.post('/columns/reorder/', data=json.dumps(payload), content_type='application/json')
        self.col1.refresh_from_db()
        self.assertEqual(self.col1.order, 5)

    def test_update_column_order_wrong_method(self):
        """Test blokowania metod innych niż POST dla reorder"""
        payload = [{"id": self.col1.id, "order": 5}, {"id": self.col2.id, "order": 1}]
        response = self.client.get('/columns/reorder/')
        self.assertEqual(response.status_code, 405)


    # --- 4. SWIMLANES (WIERSZE) ---
    def test_add_swimlane(self):
        """Test dodawania wiersza"""
        payload = {"name": "Team B"}
        response = self.client.post('/swimlanes/add/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)

    def test_add_swimlane_wrong_method(self):
        """Test blokowania metod innych niż POST dla swimlanes/add/"""
        response = self.client.get('/swimlanes/add/')
        self.assertEqual(response.status_code, 405)

    def test_delete_swimlane_and_move_tasks(self):
        """Test przenoszenia zadań do innej kolumny przy usuwaniu"""
        response = self.client.delete(f'/swimlanes/{self.swim2.id}/delete/')
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.swimlane_id, self.swim1.id) # Trafiło do col2

    def test_delete_last_swimlane_forbidden(self):
        """Test blokady usuwania ostatniego wiersza"""
        response1 = self.client.delete(f'/swimlanes/{self.swim1.id}/delete/')
        response2 = self.client.delete(f'/swimlanes/{self.swim2.id}/delete/')
        self.assertEqual(response2.status_code, 400) # Ostatni wiersz

    def test_delete_swimlane_not_found(self):
        """Testuje sytuację, gdy wiersz o podanym ID nie istnieje"""
        response = self.client.delete(
            '/swimlanes/99999/delete/'
        )
        
        # Sprawdzamy czy zwrócono 404 i odpowiedni komunikat
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error'], "Swimlane not found")

    def test_delete_swimlane_wrong_method(self):
        """Test blokowania metod innych niż DELETE dla swimlanes/delete/"""
        response = self.client.get(f'/swimlanes/{self.swim1.id}/delete/')
        self.assertEqual(response.status_code, 405)

    def test_update_swimlane_settings(self):
        """Test zmiany ustawień wiersza (kolory, limit)"""
        payload = {"limit": 10,"name": "Updated Name", }
        response = self.client.patch(f'/swimlanes/{self.swim1.id}/update/', data=json.dumps(payload), content_type='application/json')
        self.swim1.refresh_from_db()
        self.assertEqual(self.swim1.limit, 10)
        self.assertEqual(self.swim1.name, "Updated Name")
        self.assertEqual(response.json()['status'], "updated")


    def test_update_swimlane_not_found(self):
        """Testuje sytuację, gdy wiersz o podanym ID nie istnieje"""
        response = self.client.patch(
            '/swimlanes/99999/update/',
            data=json.dumps({"name": "Updated Name"}),
            content_type='application/json'
        )
        
        # Sprawdzamy czy zwrócono 404 i odpowiedni komunikat
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error'], "Swimlane not found")

    def test_update_swimlane_wrong_method(self):
        """Test blokowania metod innych niż PATCH dla swimlanes/update/"""
        response = self.client.post(f'/swimlanes/{self.swim1.id}/update/', data=json.dumps({"name": "Invalid"}), content_type='application/json')
        self.assertEqual(response.status_code, 405)


    # --- 5. UŻYTKOWNICY ---
    def test_user_operations(self):
        """Test dodawania, usuwania i aktualizacji profilu użytkownika"""
        # Add
        resp_add = self.client.post('/users/add/', data=json.dumps({"username": "new"}), content_type='application/json')
        user_id = resp_add.json()['id']
        
        # Update Profile
        payload = {"task_limit": 5, "color": "#00ff00"}
        self.client.patch(f'/users/{user_id}/update/', data=json.dumps(payload), content_type='application/json')
        new_user_profile = UserProfile.objects.get(user_id=user_id)
        self.assertEqual(new_user_profile.task_limit, 5)

        # Delete
        resp_del = self.client.delete(f'/users/{user_id}/delete/')
        self.assertEqual(resp_del.status_code, 200)

    def test_delete_user_not_found(self):
        """Testuje sytuację, gdy użytkownik o podanym ID nie istnieje"""
        response = self.client.delete(
            '/users/99999/delete/'
        )
        
        # Sprawdzamy czy zwrócono 404 i odpowiedni komunikat
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error'], "User not found")

    def test_delete_user_wrong_method(self):
        """Test blokowania metod innych niż DELETE dla users/delete/"""
        response = self.client.get(f'/users/{self.user.id}/delete/')
        self.assertEqual(response.status_code, 405)
    
    def test_update_user_not_found(self):
        """Testuje sytuację, gdy użytkownik o podanym ID nie istnieje"""
        response = self.client.patch(
            '/users/99999/update/',
            data=json.dumps({"task_limit": 5}),
            content_type='application/json'
        )
        
        # Sprawdzamy czy zwrócono 404 i odpowiedni komunikat
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error'], "User not found")


    def test_update_user_wrong_method(self):
        """Test blokowania metod innych niż PATCH dla users/update/"""
        response = self.client.post(f'/users/{self.user.id}/update/', data=json.dumps({"task_limit": 10}), content_type='application/json')
        self.assertEqual(response.status_code, 405)



    # --- 6. SUBTASKI ---
    def test_subtask_crud(self):
        """Test operacji na podzadaniach"""
        # Add
        resp_add = self.client.post(f'/tasks/{self.task.id}/subtasks/add/', data=json.dumps({"content": "Sub"}), content_type='application/json')
        sub_id = resp_add.json()['id']
        
        # Update
        self.client.patch(f'/subtasks/{sub_id}/update/', data=json.dumps({"is_completed": True, "content": "Updated Subtask"}), content_type='application/json')
        self.assertTrue(Subtask.objects.get(id=sub_id).is_completed)
        self.assertEqual(Subtask.objects.get(id=sub_id).content, "Updated Subtask")
        # Delete
        resp_del = self.client.delete(f'/subtasks/{sub_id}/delete/')
        self.assertEqual(resp_del.status_code, 200)

    # --- 7. INNE SCENARIUSZE ---

    def test_column_str_returns_title(self):
        # 1. Przygotowanie: tworzymy obiekt modelu
        column = Column.objects.create(title="Do Zrobienia")
        
        # 2. Działanie i Sprawdzenie: czy str(obiekt) == tytuł
        self.assertEqual(str(column), "Do Zrobienia")




