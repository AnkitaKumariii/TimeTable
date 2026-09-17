def test_create_batch(auth_client):
    response = auth_client.post("/api/batches", json={"name": "B1", "color": "#123456"})
    assert response.status_code == 201
    assert response.json()["name"] == "B1"

def test_create_batch_duplicate(auth_client):
    auth_client.post("/api/batches", json={"name": "B2"})
    response = auth_client.post("/api/batches", json={"name": "B2"})
    assert response.status_code == 409

def test_list_batches(auth_client):
    auth_client.post("/api/batches", json={"name": "B3"})
    response = auth_client.get("/api/batches")
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_get_batch(auth_client):
    create_res = auth_client.post("/api/batches", json={"name": "B4"})
    batch_id = create_res.json()["id"]
    response = auth_client.get(f"/api/batches/{batch_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "B4"

def test_update_batch(auth_client):
    create_res = auth_client.post("/api/batches", json={"name": "B5"})
    batch_id = create_res.json()["id"]
    response = auth_client.patch(f"/api/batches/{batch_id}", json={"name": "B5_updated"})
    assert response.status_code == 200
    assert response.json()["name"] == "B5_updated"

def test_delete_batch(auth_client):
    create_res = auth_client.post("/api/batches", json={"name": "B6"})
    batch_id = create_res.json()["id"]
    response = auth_client.delete(f"/api/batches/{batch_id}")
    assert response.status_code == 204
    get_res = auth_client.get(f"/api/batches/{batch_id}")
    assert get_res.status_code == 404
