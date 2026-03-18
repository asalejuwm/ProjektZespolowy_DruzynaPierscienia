from django.db import models

class Column(models.Model):
    title = models.CharField(max_length=100, unique=True)
    limit = models.IntegerField(default=3)
    order = models.IntegerField(default=0)

    def __str__(self):
        return self.title

class Task(models.Model):
    content = models.TextField()
    column = models.ForeignKey(Column, related_name='tasks', on_delete=models.CASCADE)
    order = models.IntegerField(default=0)

    def __str__(self):
        return self.content[:20]