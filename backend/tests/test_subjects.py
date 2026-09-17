def test_create_subject(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Subj_Batch_1"})
    batch_id = batch_res.json()["id"]
    
    response = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Math",
        "short_code": "M101",
        "hours_per_week": 4
    })
    assert response.status_code == 201
    assert response.json()["name"] == "Math"

def test_list_subjects(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Subj_Batch_2"})
    batch_id = batch_res.json()["id"]
    auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Physics",
        "short_code": "P101"
    })
    batch2_res = auth_client.post("/api/batches", json={"name": "Subj_Batch_Another"})
    batch2_id = batch2_res.json()["id"]
    auth_client.post("/api/subjects", json={
        "batch_id": batch2_id,
        "name": "Chemistry",
        "short_code": "C101"
    })
    
    response = auth_client.get(f"/api/subjects?batch_id={batch_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert all(sub["batch_id"] == batch_id for sub in data)

def test_update_subject(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Subj_Batch_3"})
    batch_id = batch_res.json()["id"]
    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Chem",
        "short_code": "C101"
    })
    sub_id = sub_res.json()["id"]
    
    response = auth_client.patch(f"/api/subjects/{sub_id}", json={"name": "Chemistry"})
    assert response.status_code == 200
    assert response.json()["name"] == "Chemistry"

def test_delete_subject(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Subj_Batch_4"})
    batch_id = batch_res.json()["id"]
    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Bio",
        "short_code": "B101"
    })
    sub_id = sub_res.json()["id"]
    
    response = auth_client.delete(f"/api/subjects/{sub_id}")
    assert response.status_code == 204
    
    get_res = auth_client.get(f"/api/subjects/{sub_id}")
    assert get_res.status_code == 404
