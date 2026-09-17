def test_create_faculty(auth_client):
    response = auth_client.post("/api/faculty", json={"name": "Prof. Smith", "email": "smith@test.com"})
    assert response.status_code == 201
    assert response.json()["name"] == "Prof. Smith"

def test_list_faculty(auth_client):
    auth_client.post("/api/faculty", json={"name": "Prof. Jones"})
    response = auth_client.get("/api/faculty")
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_get_faculty(auth_client):
    create_res = auth_client.post("/api/faculty", json={"name": "Prof. A"})
    faculty_id = create_res.json()["id"]
    response = auth_client.get(f"/api/faculty/{faculty_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Prof. A"

def test_update_faculty(auth_client):
    create_res = auth_client.post("/api/faculty", json={"name": "Prof. B"})
    faculty_id = create_res.json()["id"]
    response = auth_client.patch(f"/api/faculty/{faculty_id}", json={"name": "Prof. B_updated"})
    assert response.status_code == 200
    assert response.json()["name"] == "Prof. B_updated"

def test_delete_faculty(auth_client):
    create_res = auth_client.post("/api/faculty", json={"name": "Prof. C"})
    faculty_id = create_res.json()["id"]
    response = auth_client.delete(f"/api/faculty/{faculty_id}")
    assert response.status_code == 204
    get_res = auth_client.get(f"/api/faculty/{faculty_id}")
    assert get_res.status_code == 404
