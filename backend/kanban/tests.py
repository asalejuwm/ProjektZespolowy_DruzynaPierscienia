import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from .models import Column, Task, Swimlane, UserProfile, Subtask

class KanbanFullViewsTest(TestCase):
    def setUp(self):
        self.client = Client()
        # Podstawowa struktura
        self.col1 = Column.objects.create(title="To do", order=0, limit=2)
        self.col2 = Column.objects.create(title="Done", order=1)
        self.swim1 = Swimlane.objects.create(name="Team A", order=0)
        
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

    def test_move_task_position(self):
        """Test zmiany kolejności i komórki zadania"""
        payload = {"column_id": self.col2.id, "swimlane_id": self.swim1.id, "position": 0}
        response = self.client.patch(f'/tasks/{self.task.id}/move/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.column_id, self.col2.id)

    def test_update_task_content_and_limit(self):
        """Test edycji treści i walidacji limitu przypisań"""
        # Najpierw przypisujemy jedno zadanie (limit użytkownika to 1)
        self.task.assignees.add(self.user)
        
        # Próba przypisania tego samego użytkownika do innego zadania
        task2 = Task.objects.create(content="Task 2", column=self.col1, swimlane=self.swim1)
        payload = {"assignee_ids": [self.user.id], "content": "Updated Content"}
        response = self.client.patch(f'/tasks/{task2.id}/update/', data=json.dumps(payload), content_type='application/json')
        
        self.assertEqual(response.status_code, 400) # Oczekiwany błąd limitu

    def test_delete_task(self):
        """Test usuwania zadania"""
        response = self.client.delete(f'/tasks/{self.task.id}/delete/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Task.objects.filter(id=self.task.id).exists())

    # --- 3. OPERACJE NA KOLUMNACH ---
    def test_add_column_validation(self):
        """Test dodawania kolumny i walidacji duplikatów"""
        payload = {"title": "To do"} # Istnieje już w setUp
        response = self.client.post('/columns/add/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_delete_column_and_move_tasks(self):
        """Test przenoszenia zadań do innej kolumny przy usuwaniu"""
        response = self.client.delete(f'/columns/{self.col1.id}/delete/')
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.column_id, self.col2.id) # Trafiło do col2

    def test_update_column_settings(self):
        """Test zmiany ustawień kolumny (kolory, limit)"""
        payload = {"limit": 10, "header_color": "#000000"}
        response = self.client.patch(f'/columns/{self.col1.id}/update/', data=json.dumps(payload), content_type='application/json')
        self.col1.refresh_from_db()
        self.assertEqual(self.col1.limit, 10)
        self.assertEqual(self.col1.header_color, "#000000")

    def test_update_column_order(self):
        """Test zmiany kolejności kolumn"""
        payload = [{"id": self.col1.id, "order": 5}, {"id": self.col2.id, "order": 1}]
        response = self.client.post('/columns/reorder/', data=json.dumps(payload), content_type='application/json')
        self.col1.refresh_from_db()
        self.assertEqual(self.col1.order, 5)

    # --- 4. SWIMLANES (WIERSZE) ---
    def test_add_swimlane(self):
        """Test dodawania wiersza"""
        payload = {"name": "Team B"}
        response = self.client.post('/swimlanes/add/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)

    def test_delete_last_swimlane_forbidden(self):
        """Test blokady usuwania ostatniego wiersza"""
        response = self.client.delete(f'/swimlanes/{self.swim1.id}/delete/')
        self.assertEqual(response.status_code, 400) # Ostatni wiersz

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

    # --- 6. SUBTASKI ---
    def test_subtask_crud(self):
        """Test operacji na podzadaniach"""
        # Add
        resp_add = self.client.post(f'/tasks/{self.task.id}/subtasks/add/', data=json.dumps({"content": "Sub"}), content_type='application/json')
        sub_id = resp_add.json()['id']
        
        # Update
        self.client.patch(f'/subtasks/{sub_id}/update/', data=json.dumps({"is_completed": True}), content_type='application/json')
        self.assertTrue(Subtask.objects.get(id=sub_id).is_completed)
        
        # Delete
        resp_del = self.client.delete(f'/subtasks/{sub_id}/delete/')
        self.assertEqual(resp_del.status_code, 200)