def test_add_timetable_entry(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "TT_Batch"})
    batch_id = batch_res.json()["id"]
    
    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Math TT",
        "short_code": "MTT"
    })
    sub_id = sub_res.json()["id"]
    
    fac_res = auth_client.post("/api/faculty", json={"name": "Prof TT"})
    fac_id = fac_res.json()["id"]
    
    slot_res = auth_client.post("/api/time-slots", json={
        "label": "TT Slot",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "sort_order": 10
    })
    slot_id = slot_res.json()["id"]
    
    room_res = auth_client.post("/api/rooms", json={
        "name": "Room A",
        "capacity": 50
    })
    room_id = room_res.json()["id"]
    
    response = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_id": fac_id,
        "day": "Monday",
        "time_slot_id": slot_id,
        "room_id": room_id
    })
    
    assert response.status_code == 201
    assert response.json()["status"] in ["ok", "warning"]

def test_list_timetable_entries(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "List_TT_Batch"})
    batch_id = batch_res.json()["id"]
    
    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Math List TT",
        "short_code": "MLTT"
    })
    sub_id = sub_res.json()["id"]
    
    fac_res = auth_client.post("/api/faculty", json={"name": "Prof List TT"})
    fac_id = fac_res.json()["id"]
    
    slot_res = auth_client.post("/api/time-slots", json={
        "label": "List TT Slot",
        "start_time": "11:00:00",
        "end_time": "12:00:00",
        "sort_order": 11
    })
    slot_id = slot_res.json()["id"]
    
    room_res = auth_client.post("/api/rooms", json={
        "name": "Room B",
        "capacity": 30
    })
    room_id = room_res.json()["id"]
    
    create_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_id": fac_id,
        "day": "Tuesday",
        "time_slot_id": slot_id,
        "room_id": room_id
    })
    entry_id = create_res.json()["entry"]["id"]

    response = auth_client.get("/api/timetable/entries")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(entry["id"] == entry_id for entry in data)
