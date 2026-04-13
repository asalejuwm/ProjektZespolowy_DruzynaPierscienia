import json
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from .models import Column, Task, Swimlane, UserProfile, Subtask
from django.db.models import Max
from django.contrib.auth.models import User

# --- GŁÓWNY WIDOK (Pobieranie danych) ---

def tasks(request):
    cols = Column.objects.all().order_by('order')
    swims = Swimlane.objects.all().order_by('order')
    all_tasks = Task.objects.all().order_by('order')

    users_qs = User.objects.select_related('userprofile').all()
    users_data = []
    for u in users_qs:
        limit = u.userprofile.task_limit if hasattr(u, 'userprofile') else 3
        users_data.append({
            'id': u.id, 
            'username': u.username, 
            'task_limit': limit,
            'color': u.userprofile.color if hasattr(u, 'userprofile') else '#64748b'
        })

    task_data = []
    for t in all_tasks:
        task_data.append({
            'id': t.id,
            'content': t.content,
            'column_id': t.column_id,
            'swimlane_id': t.swimlane_id,
            'order': t.order,
            'assignee_ids': list(t.assignees.values_list('id', flat=True)),
            'subtasks': list(t.subtasks.values('id', 'content', 'is_completed')),
        })

    return JsonResponse({
        "columns": list(cols.values('id', 'title', 'limit', 'order', 'header_color', 'bg_color')),
        "swimlanes": list(swims.values('id', 'name', 'limit', 'order', 'color')),
        "tasks": task_data,
        "users": users_data
    }, safe=False)

# --- OPERACJE NA ZADANIACH ---

@csrf_exempt
def add_task(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        col = Column.objects.get(id=data['column_id'])
        swim = Swimlane.objects.get(id=data['swimlane_id'])
        
        # Obliczamy kolejność wewnątrz konkretnej komórki (przecięcie Kolumna x Osoba)
        max_order = Task.objects.filter(column=col, swimlane=swim).aggregate(Max('order'))['order__max'] or 0
        
        task = Task.objects.create(
            content=data['content'], 
            column=col,
            swimlane=swim,
            order=max_order + 1 
        )

        default_texts = ["Research", "Implementation", "Testing", "Documentation"]
        created_subtasks = []
        for sub_text in default_texts:
            sub = Subtask.objects.create(task=task, content=sub_text)
            created_subtasks.append({
                "id": sub.id,
                "content": sub.content,
                "is_completed": sub.is_completed
            })
            
        return JsonResponse({
            "id": task.id, 
            "content": task.content,
            "column_id": task.column_id,
            "swimlane_id": task.swimlane_id,
            "subtasks": created_subtasks,
            "is_completed": task.is_completed
        }, status=201)
        
    return HttpResponseNotAllowed(['POST'])

@csrf_exempt
def move_task(request, task_id):
    if request.method == 'PATCH':
        data = json.loads(request.body)
        new_column_id = data.get('column_id')
        new_swimlane_id = data.get('swimlane_id')
        new_index = data.get('position', 0)

        task = Task.objects.get(id=task_id)
        new_col = Column.objects.get(id=new_column_id)
        new_swim = Swimlane.objects.get(id=new_swimlane_id)

        # Pobieramy zadania z docelowej komórki, żeby przeliczyć ich kolejność (order)
        other_tasks = list(Task.objects.filter(column=new_col, swimlane=new_swim).exclude(id=task_id).order_by('order'))

        # Wstawiamy nasze zadanie na wybraną pozycję
        other_tasks.insert(new_index, task)
        
        # Zapisujemy nową kolejność dla wszystkich zadań w tej komórce
        for i, t in enumerate(other_tasks):
            t.order = i
            t.column = new_col
            t.swimlane = new_swim
            t.save()

        return JsonResponse({"status": "ok"})
    return HttpResponseNotAllowed(['PATCH'])

@csrf_exempt
def update_task(request, task_id):
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            task = Task.objects.get(id=task_id)

            # --- DODAJ TO: Obsługa zmiany treści zadania ---
            if 'content' in data:
                task.content = data['content']

            if 'content' in data:
                task.content = data['content']
            if 'is_completed' in data:
                task.is_completed = data['is_completed']

            # --- Istniejąca logika przypisywania osób ---
            if 'assignee_ids' in data:
                new_assignee_ids = data['assignee_ids']
                
                for u_id in new_assignee_ids:
                    # Sprawdzamy limit tylko dla nowych osób (których jeszcze nie ma w zadaniu)
                    if not task.assignees.filter(id=u_id).exists():
                        user = User.objects.get(id=u_id)
                        current_tasks_count = user.assigned_tasks.count()
                        
                        user_limit = getattr(user, 'userprofile', None).task_limit if hasattr(user, 'userprofile') else 3
                        
                        if current_tasks_count >= user_limit:
                            return JsonResponse({
                                "error": f"User {user.username} already reached their task limit ({user_limit})!"
                            }, status=400)
                
                task.assignees.set(new_assignee_ids)
            
            # save() teraz zapisze zmieniony 'content' do bazy
            task.save()
            return JsonResponse({"status": "success"})
            
        except Task.DoesNotExist:
            return JsonResponse({"error": "Task not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return HttpResponseNotAllowed(['PATCH'])

@csrf_exempt
def delete_task(request, task_id):
    if request.method == 'DELETE':
        try:
            task = Task.objects.get(id=task_id)
            task.delete()
            return JsonResponse({"message": "Task deleted"}, status=200)
        except Task.DoesNotExist:
            return JsonResponse({"error": "Task does not exist"}, status=404)
    return HttpResponseNotAllowed(['DELETE'])

# --- OPERACJE NA KOLUMNACH ---

@csrf_exempt
def add_column(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        title = data['title'].strip()

        if Column.objects.filter(title__iexact=title).exists():
            return JsonResponse({"error": f'Column "{title}" already exists'}, status=400)

        max_order = Column.objects.aggregate(Max('order'))['order__max'] or 0
        
        new_col = Column.objects.create(
            title=data['title'], 
            limit=data.get('limit', 5), 
            order=max_order + 1,
            header_color=data.get('header_color', '#c7ddff'),
            bg_color=data.get('bg_color', '#ffffff')
        )

        return JsonResponse({
            "id": new_col.id, 
            "title": new_col.title, 
            "order": new_col.order,
            "limit": new_col.limit,
            "header_color": new_col.header_color,
            "bg_color": new_col.bg_color
        }, status=201)
    return HttpResponseNotAllowed(['POST'])

@csrf_exempt
def delete_column(request, column_id):
    if request.method == 'DELETE':
        try:
            column = Column.objects.get(id=column_id)
            # Przenosimy zadania do innej kolumny przed usunięciem (opcjonalnie)
            target_column = Column.objects.exclude(id=column_id).first()
            if target_column:
                Task.objects.filter(column=column).update(column=target_column)
            
            column.delete()
            return JsonResponse({"status": "deleted"})
        except Column.DoesNotExist:
            return JsonResponse({"error": "Column not found"}, status=404)
    return HttpResponseNotAllowed(['DELETE'])

@csrf_exempt
def update_column(request, column_id):
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            col = Column.objects.get(id=column_id)
            
            if 'limit' in data:
                col.limit = data['limit']
            if 'title' in data:
                col.title = data['title']
            if 'header_color' in data:     # NOWE
                col.header_color = data['header_color']
            if 'bg_color' in data:         # NOWE
                col.bg_color = data['bg_color']
                
            col.save()
            return JsonResponse({"status": "updated"})
        except Column.DoesNotExist:
            return JsonResponse({"error": "Column not found"}, status=404)
    return HttpResponseNotAllowed(['PATCH'])

@csrf_exempt
def update_column_order(request):
    if request.method == 'POST':
        data = json.loads(request.body) 
        for item in data:
            Column.objects.filter(id=item['id']).update(order=item['order'])
        return JsonResponse({"status": "order updated"})
    return HttpResponseNotAllowed(['POST'])

# --- DODATKOWE: OSOBY (SWIMLANES) ---

@csrf_exempt
def add_swimlane(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        max_order = Swimlane.objects.aggregate(Max('order'))['order__max'] or 0
        new_swim = Swimlane.objects.create(
            name=data['name'],
            order=max_order + 1
        )
        return JsonResponse({"id": new_swim.id, "name": new_swim.name}, status=201)
    return HttpResponseNotAllowed(['POST'])

@csrf_exempt
def delete_swimlane(request, swimlane_id):
    if request.method == 'DELETE':
        try:
            swim_to_delete = Swimlane.objects.get(id=swimlane_id)
            
            target_swimlane = Swimlane.objects.exclude(id=swimlane_id).order_by('order').first()

            if target_swimlane:
                Task.objects.filter(swimlane=swim_to_delete).update(swimlane=target_swimlane)
                
                swim_to_delete.delete()
                return JsonResponse({"status": "deleted_and_moved"})
            else:
                return JsonResponse({"error": "The last row cannot be deleted"}, status=400)
        except Swimlane.DoesNotExist:
            return JsonResponse({"error": "Swimlane not found"}, status=404)
    return HttpResponseNotAllowed(['DELETE'])

@csrf_exempt
def update_swimlane(request, swimlane_id):
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            swim = Swimlane.objects.get(id=swimlane_id)
            
            if 'limit' in data:
                swim.limit = data['limit']
            if 'name' in data:
                swim.name = data['name']
                
            swim.save()
            return JsonResponse({"status": "updated"})
        except Swimlane.DoesNotExist:
            return JsonResponse({"error": "Swimlane not found"}, status=404)
    return HttpResponseNotAllowed(['PATCH'])

@csrf_exempt
def add_user(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = User.objects.create_user(username=data['username'], password='password123')
        return JsonResponse({"id": user.id, "username": user.username})

@csrf_exempt
def delete_user(request, user_id):
    if request.method == 'DELETE':
        try:
            user = User.objects.get(id=user_id)
            user.delete()
            return JsonResponse({"status": "deleted"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    return HttpResponseNotAllowed(['DELETE'])

@csrf_exempt
def update_user(request, user_id):
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            user = User.objects.get(id=user_id)
            profile, created = UserProfile.objects.get_or_create(user=user)
            
            if 'task_limit' in data:
                profile.task_limit = data['task_limit']

            
            if 'color' in data:
                profile.color = data['color']

            profile.save()

            return JsonResponse({"status": "updated"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    return HttpResponseNotAllowed(['PATCH'])

@csrf_exempt
def add_subtask(request, task_id):
    if request.method == 'POST':
        data = json.loads(request.body)
        task = Task.objects.get(id=task_id)
        subtask = Subtask.objects.create(task=task, content=data['content'])
        return JsonResponse({"id": subtask.id, "content": subtask.content, "is_completed": subtask.is_completed})

@csrf_exempt
def update_subtask(request, subtask_id):
    if request.method == 'PATCH':
        data = json.loads(request.body)
        subtask = Subtask.objects.get(id=subtask_id)
        if 'content' in data:
            subtask.content = data['content']
        if 'is_completed' in data:
            subtask.is_completed = data['is_completed']
        subtask.save()
        return JsonResponse({"status": "updated"})

@csrf_exempt
def delete_subtask(request, subtask_id):
    if request.method == 'DELETE':
        Subtask.objects.filter(id=subtask_id).delete()
        return JsonResponse({"status": "deleted"})