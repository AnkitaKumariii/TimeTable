def test_login(client, admin_user):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "testpassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_invalid(client, admin_user):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "wrongpassword"}
    )
    assert response.status_code == 401
