import json
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from .models import Column, Task
from django.db.models import Max

# --- TASKS ---

def tasks(request):
    columns = Column.objects.all().order_by('order')
    data = []
    for col in columns:
        data.append({
            "id": col.id,
            "title": col.title,
            "limit": col.limit,
            "items": list(col.tasks.all().order_by('order').values('id', 'content'))
        })
    return JsonResponse(data, safe=False)

@csrf_exempt
def add_task(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        col_id = data['column_id']
        col = Column.objects.get(id=col_id)
        
        max_order = Task.objects.filter(column=col).aggregate(Max('order'))['order__max'] or 0
        
        task = Task.objects.create(
            content=data['content'], 
            column=col,
            order=max_order + 1 
        )
        return JsonResponse({"id": task.id, "content": task.content}, status=201)
    return HttpResponseNotAllowed(['POST'])

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

@csrf_exempt
def update_task(request, task_id):
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            task = Task.objects.get(id=task_id)
            
            if 'content' in data:
                task.content = data['content']
                task.save()
                
            return JsonResponse({"status": "updated", "content": task.content})
        except Task.DoesNotExist:
            return JsonResponse({"error": "Task not found"}, status=404)
            
    return HttpResponseNotAllowed(['PATCH'])

@csrf_exempt
def move_task(request, task_id):
    if request.method == 'PATCH':
        data = json.loads(request.body)
        new_column_id = data.get('column_id')
        new_index = data.get('position', 0)

        task = Task.objects.get(id=task_id)
        new_col = Column.objects.get(id=new_column_id)

        other_tasks = list(Task.objects.filter(column=new_col).exclude(id=task_id).order_by('order'))

        other_tasks.insert(new_index, task)
        for i, t in enumerate(other_tasks):
            t.order = i
            t.column = new_col 
            t.save()

        return JsonResponse({"status": "ok"})
    return HttpResponseNotAllowed(['PATCH'])

# --- COLUMNS ---

@csrf_exempt
def add_column(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        title = data['title'].strip()

        if Column.objects.filter(title__iexact=title).exists():
            return JsonResponse(
                {"error": f'Column "{title}" already exists'},
                status=400
            )

        max_order = Column.objects.aggregate(Max('order'))['order__max'] or 0
        
        new_col = Column.objects.create(
            title=data['title'], 
            limit=data.get('limit', 5), 
            order=max_order + 1
        )

        return JsonResponse({
            "id": new_col.id, 
            "title": new_col.title, 
            "order": new_col.order,
            "limit": new_col.limit
        }, status=201)
    
    return HttpResponseNotAllowed(['POST'])

@csrf_exempt
def delete_column(request, column_id):
    if request.method == 'DELETE':
        try:
            column = Column.objects.get(id=column_id)

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
        data = json.loads(request.body)
        col = Column.objects.get(id=column_id)
        if 'limit' in data:
            col.limit = data['limit']
        if 'title' in data:
            col.title = data['title']
        col.save()
        return JsonResponse({"status": "updated"})
    return HttpResponseNotAllowed(['POST'])

@csrf_exempt
def update_column_order(request):
    if request.method == 'POST':
        data = json.loads(request.body) 
        for item in data:
            Column.objects.filter(id=item['id']).update(order=item['order'])
        return JsonResponse({"status": "order updated"})