#!/usr/bin/env bash
set -e

pip install -r requirements.txt
python manage.py migrate
python manage.py shell -c "
from api.models import User
User.objects.get_or_create(
    username='admin',
    defaults={
        'password': 'admin',
        'role': 'admin',
        'status': 'Active',
        'credit': 999999
    }
)
print('Admin ready!')
"