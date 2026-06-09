#!/usr/bin/env bash
set -e

chmod +x build.sh
pip install -r requirements.txt
python manage.py migrate --run-syncdb
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