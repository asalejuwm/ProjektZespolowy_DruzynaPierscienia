import json
import traceback
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from .models import Column, Task, Swimlane, UserProfile, Subtask, TaskColumnTime, Board
from django.db.models import Max
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.utils import timezone
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import random

GOOGLE_CLIENT_ID = "320328893136-i6b5di98449tu35enbckuqsidfi6n3sh.apps.googleusercontent.com"

def tasks(request):
    board_id = request.GET.get('board_id')

    try:
        board_id = int(board_id)
    except (TypeError, ValueError):
        board = Board.objects.first()
        if not board:
            return JsonResponse({
                "error": "No boards exist"
            }, status=400)
        board_id = board.id
    
    cols = Column.objects.filter(board_id=board_id).order_by('order')
    swims = Swimlane.objects.filter(board_id=board_id).order_by('order')
    all_tasks = Task.objects.filter(column__board_id=board_id).order_by('order')

    users_qs = User.objects.select_related('userprofile').filter(is_superuser=False)
    users_data = []

    for u in users_qs:
        profile = getattr(u, 'userprofile', None)
        
        limit = u.userprofile.task_limit if hasattr(u, 'userprofile') else 3
        avatar = u.userprofile.avatar_url if hasattr(u, 'userprofile') else None
        color = profile.color if (profile and profile.color) else '#64748b'

        users_data.append({
            'id': u.id, 
            'username': u.username, 
            'task_limit': limit,
            'color': u.userprofile.color if hasattr(u, 'userprofile') else '#64748b',
            'avatar_url': avatar  
        })

    now = timezone.now()
    task_data = []
    for t in all_tasks:
        entered_at = t.current_column_entered_at if t.current_column_entered_at else now
        current_stay = (now - t.current_column_entered_at).total_seconds()
        history = {ct.column_id: ct.total_duration_seconds for ct in t.column_times.all()}
        history[t.column_id] = history.get(t.column_id, 0) + current_stay
        task_data.append({
            'id': t.id,
            'content': t.content,
            'column_id': t.column_id,
            'created_at': t.created_at.isoformat(),
            'updated_at': t.updated_at.isoformat(),
            'time_in_columns': history,
            'swimlane_id': t.swimlane_id,
            'order': t.order,
            'assignee_ids': list(t.assignees.values_list('id', flat=True)),
            'subtasks': list(t.subtasks.values('id', 'content', 'is_completed')),
            'is_completed': t.is_completed,
            'parent_id': t.parent_id,
        })

    return JsonResponse({
        "columns": list(cols.values('id', 'title', 'limit', 'order', 'header_color', 'bg_color')),
        "swimlanes": list(swims.values('id', 'name', 'limit', 'order', 'color')),
        "tasks": task_data,
        "users": users_data
    }, safe=False)

@csrf_exempt
def add_task(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        col = Column.objects.get(id=data['column_id'])
        swim = Swimlane.objects.get(id=data['swimlane_id'])
            
        max_order = Task.objects.filter(column=col, swimlane=swim).aggregate(Max('order'))['order__max'] or 0

        
        task = Task.objects.create(
            content=data['content'], 
            column=col,
            swimlane=swim,
            order=max_order + 1, 
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
            "parent_id": task.parent_id,
            "subtasks": created_subtasks,
            "is_completed": task.is_completed,
            "updated_at": task.updated_at.isoformat()
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



        old_col = task.column
        new_col = Column.objects.get(id=new_column_id)
        new_swim = Swimlane.objects.get(id=new_swimlane_id)

        if new_col.title == "Done":
            unfinished_children = task.child_tasks.exclude(column__title="Done")
            if unfinished_children.exists():
                tasks_names = ", ".join([f'{child.content}' for child in unfinished_children])
                return JsonResponse({
                    "error": f"Unfinished child tasks: {tasks_names}\n\nPlease complete them before moving {task.content} to Done!"
                }, status=400)


        if old_col.id != new_col.id:
                now = timezone.now()
                duration = int((now - task.current_column_entered_at).total_seconds())
                
                record, _ = TaskColumnTime.objects.get_or_create(task=task, column=old_col)
                record.total_duration_seconds += duration
                record.save()
                
                task.current_column_entered_at = now

        other_tasks = list(Task.objects.filter(column=new_col, swimlane=new_swim).exclude(id=task_id).order_by('order'))
        other_tasks.insert(new_index, task)
        
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

            if 'content' in data:
                task.content = data['content']

            if 'content' in data:
                task.content = data['content']
            if 'is_completed' in data:
                task.is_completed = data['is_completed']

            if 'parent_id' in data: 
                task.parent_id = data['parent_id']

            if 'assignee_ids' in data:
                new_assignee_ids = data['assignee_ids']
                
                for u_id in new_assignee_ids:
                    if not task.assignees.filter(id=u_id).exists():
                        user = User.objects.get(id=u_id)
                        current_tasks_count = user.assigned_tasks.count()
                        
                        user_limit = getattr(user, 'userprofile', None).task_limit if hasattr(user, 'userprofile') else 3
                        
                        if current_tasks_count >= user_limit:
                            return JsonResponse({
                                "error": f"User {user.username} already reached their task limit ({user_limit})!"
                            }, status=400)
                
                task.assignees.set(new_assignee_ids)
            
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
            task.child_tasks.update(parent=None)
            task.delete()
            return JsonResponse({"message": "Task deleted"}, status=200)
        except Task.DoesNotExist:
            return JsonResponse({"error": "Task does not exist"}, status=404)
    return HttpResponseNotAllowed(['DELETE'])

# --- COLUMNS ---

@csrf_exempt
def add_column(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        title = data['title'].strip()
        board_id = data.get('board_id')

        if Column.objects.filter(board_id=board_id,title__iexact=title).exists():
            return JsonResponse({"error": f'Column "{title}" already exists'}, status=400)

        max_order = Column.objects.aggregate(Max('order'))['order__max'] or 0
        
        new_col = Column.objects.create(
            board_id=board_id,
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
            target_column = Column.objects.exclude(id=column_id).order_by('order').first()
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
            if 'header_color' in data:     
                col.header_color = data['header_color']
            if 'bg_color' in data:         
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

# --- SWIMLANES ---

@csrf_exempt
def add_swimlane(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        max_order = Swimlane.objects.aggregate(Max('order'))['order__max'] or 0
        board_id = data.get('board_id')
        new_swim = Swimlane.objects.create(
            board_id=board_id,
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

@csrf_exempt
def google_auth(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        try:
            data = json.loads(request.body)
        except Exception:
            return JsonResponse({'error': 'Invalid JSON body'}, status=400)

        token = data.get('token')
        if not token:
            return JsonResponse({'error': 'Token missing'}, status=400)
        
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        
        email = idinfo.get('email')
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')
        picture = idinfo.get('picture', '')

        if not email:
            return JsonResponse({'error': 'Token missing email'}, status=400)

        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                'email': email,
                'first_name': first_name,
                'last_name': last_name
            }
        )

        profile, prof_created = UserProfile.objects.get_or_create(user=user)
        profile.avatar_url = picture
        
        if prof_created or not profile.color:
            colors = ['#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#eab308']
            profile.color = random.choice(colors)
        
        profile.save()

        if not Board.objects.exists():
            board = Board.objects.create(name="Główna Tablica")
            Column.objects.create(board=board, title='To do', limit=0, order=0)
            Column.objects.create(board=board, title='Done', limit=0, order=1)
            Swimlane.objects.create(board=board, name='General', limit=0, order=0)
            print("INFO: Wykryto czystą bazę danych. Utworzono domyślną tablicę.")

        return JsonResponse({
            'id': user.id,
            'username': f"{first_name} {last_name}".strip() or user.username,
            'email': user.email,
            'avatar_url': profile.avatar_url,
            'color': profile.color
        })

    except ValueError:
        return JsonResponse({'error': 'Invalid token signature'}, status=400)
    except Exception as e:
        print(f"CRITICAL ERROR IN GOOGLE_AUTH: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': f"Internal server error: {str(e)}"}, status=500)
    
@csrf_exempt
def add_board(request):
    print("ADD BOARD CALLED")


    if request.method == 'POST':

        data = json.loads(request.body)
        print("DATA:", data)

        board_name = data.get('name', '').strip()

        if not board_name:
            return JsonResponse(
                {"error": "Board name is required"},
                status=400
            )

        if Board.objects.filter(name=board_name).exists():
            return JsonResponse(
                {"error": "Board already exists"},
                status=400
            )

        board = Board.objects.create(
            name=board_name,
        )

        Column.objects.create(
            board=board,
            title='To do',
            limit=0,
            order=0
        )

        Column.objects.create(
            board=board,
            title='Done',
            limit=0,
            order=1
        )

        Swimlane.objects.create(
            board=board,
            name='General',
            limit=0,
            order=0
        )

        return JsonResponse({
            "id": board.id,
            "name": board.name
        }, status=201)

    return HttpResponseNotAllowed(['POST'])

def boards(request):

    boards = Board.objects.all().order_by('name')

    return JsonResponse(
        list(
            boards.values(
                'id',
                'name'
            )
        ),
        safe=False
    )

@csrf_exempt
def delete_board(request, board_id):
    if request.method == 'DELETE':
        
        if Board.objects.count() <= 1:
            return JsonResponse(
                {"error": "Cannot delete the last board"},
                status=400
            )

        try:
            board = Board.objects.get(id=board_id)
        except Board.DoesNotExist:
            return JsonResponse(
                {"error": "Board not found"},
                status=404
            )

        board.delete()

        return JsonResponse({
            "success": True
        })

    return HttpResponseNotAllowed(['DELETE'])