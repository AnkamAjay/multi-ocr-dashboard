from auth_utils import get_password_hash
try:
    print(get_password_hash("mypassword"))
except Exception as e:
    import traceback
    traceback.print_exc()
