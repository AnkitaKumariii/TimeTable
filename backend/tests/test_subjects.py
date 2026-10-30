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

def test_update_subject_hours_per_week_and_batch_id(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Subj_Batch_Lab"})
    batch_id = batch_res.json()["id"]
    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Hardware Lab",
        "short_code": "HWLAB",
        "type": "lab",
        "hours_per_week": 2,
    })
    assert sub_res.status_code == 201
    sub_id = sub_res.json()["id"]

    # Updating hours_per_week while including batch_id in payload must succeed
    patch_res = auth_client.patch(f"/api/subjects/{sub_id}", json={
        "batch_id": batch_id,
        "name": "Hardware Lab",
        "short_code": "HWLAB",
        "hours_per_week": 4,
        "type": "lab",
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["hours_per_week"] == 4

def test_update_subject_reduce_hpw_below_scheduled_lab_entries_rejected(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Subj_Batch_Lab2"})
    batch_id = batch_res.json()["id"]
    group_res = auth_client.post(f"/api/batches/{batch_id}/groups", json={"name": "Group 1"})
    group_id = group_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Embedded Lab",
        "short_code": "EMBLAB",
        "type": "lab",
        "hours_per_week": 2,
    })
    sub_id = sub_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Lab Room 101"})
    room_id = room_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof. Smith"})
    fac_id = fac_res.json()["id"]

    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Period 1", "start_time": "09:00:00", "end_time": "10:00:00", "sort_order": 1
    })
    slot1_id = slot1_res.json()["id"]
    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Period 2", "start_time": "10:00:00", "end_time": "11:00:00", "sort_order": 2
    })
    slot2_id = slot2_res.json()["id"]

    # Create 2 lab entries for Group 1
    bulk_res = auth_client.post("/api/timetable/entries/bulk", json=[
        {"batch_id": batch_id, "group_id": group_id, "subject_id": sub_id, "faculty_ids": [fac_id], "room_id": room_id, "day": "Monday", "time_slot_id": slot1_id},
        {"batch_id": batch_id, "group_id": group_id, "subject_id": sub_id, "faculty_ids": [fac_id], "room_id": room_id, "day": "Monday", "time_slot_id": slot2_id},
    ])
    assert bulk_res.status_code in (200, 201)

    # Attempting to reduce hours_per_week to 1 when 2 are scheduled must return 400
    res = auth_client.patch(f"/api/subjects/{sub_id}", json={"hours_per_week": 1})
    assert res.status_code == 400
    assert "Cannot reduce hours/week to 1" in res.json()["detail"]

    # Changing subject type to theory with entries must return 400
    res_type = auth_client.patch(f"/api/subjects/{sub_id}", json={"type": "theory"})
    assert res_type.status_code == 400
    assert "Cannot change subject type while timetable entries exist" in res_type.json()["detail"]

    # Moving to another batch with entries must return 400
    batch2_res = auth_client.post("/api/batches", json={"name": "Subj_Batch_Lab_Other"})
    batch2_id = batch2_res.json()["id"]
    res_batch = auth_client.patch(f"/api/subjects/{sub_id}", json={"batch_id": batch2_id})
    assert res_batch.status_code == 400
    assert "Cannot move subject to another batch" in res_batch.json()["detail"]
