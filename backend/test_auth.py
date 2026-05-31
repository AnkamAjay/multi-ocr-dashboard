import requests

API_URL = "http://127.0.0.1:8000/api/auth"

def test_auth():
    print("Testing signup...")
    resp = requests.post(f"{API_URL}/signup", json={
        "username": "tester2",
        "email": "tester2@test.com",
        "password": "mypassword"
    })
    print("Signup resp:", resp.status_code, resp.text)
    
    print("\nTesting login...")
    resp2 = requests.post(f"{API_URL}/login", data={
        "username": "tester2",
        "password": "mypassword"
    })
    print("Login resp:", resp2.status_code, resp2.text)

if __name__ == "__main__":
    test_auth()
