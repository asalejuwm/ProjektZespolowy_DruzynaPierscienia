from django.urls import path
from .views import ( add_user, delete_user, update_user,
delete_swimlane, tasks, add_task, delete_task, update_swimlane, update_task, 
move_task, add_column, delete_column, update_column, update_column_order, 
add_swimlane, add_subtask, update_subtask, delete_subtask )

urlpatterns = [
    path('tasks/', tasks),
    path('tasks/add/', add_task),
    path('tasks/<int:task_id>/delete/', delete_task),
    path('tasks/<int:task_id>/update/', update_task),
    path('tasks/<int:task_id>/move/', move_task),
    path('columns/add/', add_column),
    path('columns/<int:column_id>/delete/', delete_column),
    path('columns/<int:column_id>/update/', update_column),
    path('columns/reorder/', update_column_order),
    path('swimlanes/add/', add_swimlane),
    path('swimlanes/<int:swimlane_id>/delete/', delete_swimlane),
    path('swimlanes/<int:swimlane_id>/update/', update_swimlane),
    path('users/add/', add_user),
    path('users/<int:user_id>/delete/', delete_user),
    path('users/<int:user_id>/update/', update_user),
    path('tasks/<int:task_id>/subtasks/add/', add_subtask),
    path('subtasks/<int:subtask_id>/update/', update_subtask),
    path('subtasks/<int:subtask_id>/delete/', delete_subtask),
]
    