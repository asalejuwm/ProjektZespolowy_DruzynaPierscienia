from django.db import models

class Column(models.Model):
    title = models.CharField(max_length=100, unique=True)
    limit = models.IntegerField(default=5)
    order = models.IntegerField(default=0)

    def __str__(self):
        return self.title

class Task(models.Model):
    content = models.TextField()
    column = models.ForeignKey(Column, related_name='tasks', on_delete=models.CASCADE)
    order = models.IntegerField(default=0)

class Swimlane(models.Model):
    name = models.CharField(max_length=100)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

class Task(models.Model):
    content = models.TextField()
    column = models.ForeignKey(Column, on_delete=models.CASCADE, related_name='tasks')
    swimlane = models.ForeignKey(Swimlane, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    order = models.IntegerField(default=0)

    def __str__(self):
        return self.content