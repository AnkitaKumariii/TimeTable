def test_create_time_slot(auth_client):
    response = auth_client.post("/api/time-slots", json={
        "label": "Slot 1",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "sort_order": 1,
        "is_break": False
    })
    assert response.status_code == 201
    assert response.json()["label"] == "Slot 1"

def test_list_time_slots(auth_client):
    auth_client.post("/api/time-slots", json={
        "label": "Slot 2",
        "start_time": "10:00:00",
        "end_time": "11:00:00",
        "sort_order": 2
    })
    response = auth_client.get("/api/time-slots")
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_update_time_slot(auth_client):
    create_res = auth_client.post("/api/time-slots", json={
        "label": "Slot 3",
        "start_time": "11:00:00",
        "end_time": "12:00:00",
        "sort_order": 3
    })
    slot_id = create_res.json()["id"]
    response = auth_client.patch(f"/api/time-slots/{slot_id}", json={"label": "Slot 3 Updated"})
    assert response.status_code == 200
    assert response.json()["label"] == "Slot 3 Updated"

def test_delete_time_slot(auth_client):
    create_res = auth_client.post("/api/time-slots", json={
        "label": "Slot 4",
        "start_time": "12:00:00",
        "end_time": "13:00:00",
        "sort_order": 4
    })
    slot_id = create_res.json()["id"]
    response = auth_client.delete(f"/api/time-slots/{slot_id}")
    assert response.status_code == 204
    get_res = auth_client.get(f"/api/time-slots/{slot_id}")
    assert get_res.status_code == 404
