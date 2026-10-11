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
    
    room_res = auth_client.post("/api/rooms", json={"name": "Room A"})
    room_id = room_res.json()["id"]
    
    response = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_ids": [fac_id],
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
    
    room_res = auth_client.post("/api/rooms", json={"name": "Room B"})
    room_id = room_res.json()["id"]
    
    create_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_ids": [fac_id],
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


def test_update_timetable_entry_replaces_faculty(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Update_Faculty_Batch"})
    batch_id = batch_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Update Faculty Subject",
        "short_code": "UFS",
    })
    sub_id = sub_res.json()["id"]

    fac_one_res = auth_client.post("/api/faculty", json={"name": "Prof Original"})
    fac_one_id = fac_one_res.json()["id"]
    fac_two_res = auth_client.post("/api/faculty", json={"name": "Prof Replacement"})
    fac_two_id = fac_two_res.json()["id"]

    slot_res = auth_client.post("/api/time-slots", json={
        "label": "Update Slot",
        "start_time": "13:00:00",
        "end_time": "14:00:00",
        "sort_order": 12,
    })
    slot_id = slot_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Room Update Faculty"})
    room_id = room_res.json()["id"]

    create_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_ids": [fac_one_id],
        "day": "Wednesday",
        "time_slot_id": slot_id,
        "room_id": room_id,
    })
    entry = create_res.json()["entry"]

    update_res = auth_client.put(f"/api/timetable/entries/{entry['id']}", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_ids": [fac_two_id],
        "day": "Wednesday",
        "time_slot_id": slot_id,
        "room_id": room_id,
        "version": entry["version"],
    })

    assert update_res.status_code == 200
    faculties = update_res.json()["entry"]["faculties"]
    assert [faculty["id"] for faculty in faculties] == [fac_two_id]
