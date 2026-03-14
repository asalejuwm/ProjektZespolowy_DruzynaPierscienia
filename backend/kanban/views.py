import json
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from .models import Column, Task

# --- TASKI ---

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
        col = Column.objects.get(id=data['column_id'])
        task = Task.objects.create(content=data['content'], column=col)
        return JsonResponse({"id": task.id, "content": task.content}, status=201)
    # Obsługiwanie innych metod, np. GET w przeglądarce
    return HttpResponseNotAllowed(['POST'])

@csrf_exempt
def delete_task(request, task_id):
    if request.method == 'DELETE':
        try:
            task = Task.objects.get(id=task_id)
            task.delete()
            return JsonResponse({"message": "Zadanie usunięte"}, status=200)
        except Task.DoesNotExist:
            return JsonResponse({"error": "Zadanie nie istnieje"}, status=404)
    
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
        task = Task.objects.get(id=task_id)
        task.column = Column.objects.get(id=data['column_id'])
        task.save()
        return JsonResponse({"status": "ok"})
    return HttpResponseNotAllowed(['POST'])

# --- KOLUMNY ---

@csrf_exempt
def add_column(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        new_col = Column.objects.create(title=data['title'])
        return JsonResponse({"id": new_col.id, "title": new_col.title}, status=201)
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