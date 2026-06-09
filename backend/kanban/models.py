from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.models import User

class Board(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Column(models.Model):
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='columns')
    title = models.CharField(max_length=100)
    limit = models.IntegerField(default=5)
    order = models.IntegerField(default=0)
    header_color = models.CharField(max_length=7, default='#c7ddff')
    bg_color = models.CharField(max_length=7, default='#ffffff')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['board', 'title'],
                name='unique_column_per_board'
            )
        ]

    def __str__(self):
        return self.title

class Swimlane(models.Model):
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='swimlanes')
    name = models.CharField(max_length=100)
    limit = models.IntegerField(default=5)
    order = models.IntegerField(default=0)
    color = models.CharField(max_length=7, default='#f1f5f9') 

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(
                fields=['board', 'name'],
                name='unique_swimlane_per_board'
            )
        ]

class Task(models.Model):
    content = models.TextField()
    column = models.ForeignKey(Column, on_delete=models.CASCADE, related_name='tasks')
    swimlane = models.ForeignKey(Swimlane, on_delete=models.CASCADE, related_name='tasks')
    order = models.IntegerField(default=0)
    assignees = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='assigned_tasks')
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    current_column_entered_at = models.DateTimeField(default=timezone.now)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='child_tasks')

    
    def __str__(self):
        return self.content

class Subtask(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='subtasks')
    content = models.CharField(max_length=255)
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return self.content

class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, db_index=True, on_delete=models.CASCADE)
    task_limit = models.IntegerField(default=3)
    color = models.CharField(max_length=7, default='#64748b') 
    avatar_url = models.URLField(max_length=1000, blank=True, null=True)

    def __str__(self):
        return f"Profile of {self.user.username}"

class TaskColumnTime(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='column_times')
    column = models.ForeignKey(Column, on_delete=models.CASCADE)
    total_duration_seconds = models.IntegerField(default=0)

    class Meta:
        unique_together = ('task', 'column')