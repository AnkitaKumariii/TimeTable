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


def test_delete_single_timetable_entry(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Delete_Single_Batch"})
    batch_id = batch_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Delete Single Sub",
        "short_code": "DSS",
    })
    sub_id = sub_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof Delete Single"})
    fac_id = fac_res.json()["id"]

    slot_res = auth_client.post("/api/time-slots", json={
        "label": "Slot Del Single",
        "start_time": "08:00:00",
        "end_time": "09:00:00",
        "sort_order": 5,
    })
    slot_id = slot_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Room Del Single"})
    room_id = room_res.json()["id"]

    create_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_ids": [fac_id],
        "day": "Monday",
        "time_slot_id": slot_id,
        "room_id": room_id,
    })
    entry_id = create_res.json()["entry"]["id"]

    # Delete entry
    del_res = auth_client.delete(f"/api/timetable/entries/{entry_id}")
    assert del_res.status_code == 204

    # Verify gone
    list_res = auth_client.get("/api/timetable/entries")
    assert not any(e["id"] == entry_id for e in list_res.json())


def test_delete_consecutive_lab_entries_cascades(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Cascade_Batch"})
    batch_id = batch_res.json()["id"]

    grp_res = auth_client.post(f"/api/batches/{batch_id}/groups", json={"name": "G1"})
    grp_id = grp_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Lab Cascade Sub",
        "short_code": "LCS",
        "type": "lab",
        "hours_per_week": 2,
    })
    sub_id = sub_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof Cascade"})
    fac_id = fac_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Room Cascade"})
    room_id = room_res.json()["id"]

    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Slot C1",
        "start_time": "10:00:00",
        "end_time": "11:00:00",
        "sort_order": 20,
    })
    slot1_id = slot1_res.json()["id"]

    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Slot C2",
        "start_time": "11:00:00",
        "end_time": "12:00:00",
        "sort_order": 21,
    })
    slot2_id = slot2_res.json()["id"]

    # Create bulk consecutive entries (Period 1 and Period 2)
    bulk_res = auth_client.post("/api/timetable/entries/bulk", json=[
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Thursday",
            "time_slot_id": slot1_id,
            "room_id": room_id,
        },
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Thursday",
            "time_slot_id": slot2_id,
            "room_id": room_id,
        },
    ])
    assert bulk_res.status_code == 201
    entry1_id = bulk_res.json()[0]["entry"]["id"]
    entry2_id = bulk_res.json()[1]["entry"]["id"]

    # Delete entry1 with default delete_consecutive=True
    del_res = auth_client.delete(f"/api/timetable/entries/{entry1_id}")
    assert del_res.status_code == 204

    # Both entry1 AND entry2 should be deleted
    list_res = auth_client.get("/api/timetable/entries")
    ids = [e["id"] for e in list_res.json()]
    assert entry1_id not in ids
    assert entry2_id not in ids


def test_delete_single_slot_when_delete_consecutive_false(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "No_Cascade_Batch"})
    batch_id = batch_res.json()["id"]

    grp_res = auth_client.post(f"/api/batches/{batch_id}/groups", json={"name": "G2"})
    grp_id = grp_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Lab No Cascade Sub",
        "short_code": "LNCS",
        "type": "lab",
        "hours_per_week": 2,
    })
    sub_id = sub_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof No Cascade"})
    fac_id = fac_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Room No Cascade"})
    room_id = room_res.json()["id"]

    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Slot NC1",
        "start_time": "14:00:00",
        "end_time": "15:00:00",
        "sort_order": 25,
    })
    slot1_id = slot1_res.json()["id"]

    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Slot NC2",
        "start_time": "15:00:00",
        "end_time": "16:00:00",
        "sort_order": 26,
    })
    slot2_id = slot2_res.json()["id"]

    bulk_res = auth_client.post("/api/timetable/entries/bulk", json=[
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Friday",
            "time_slot_id": slot1_id,
            "room_id": room_id,
        },
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Friday",
            "time_slot_id": slot2_id,
            "room_id": room_id,
        },
    ])
    assert bulk_res.status_code == 201
    entry1_id = bulk_res.json()[0]["entry"]["id"]
    entry2_id = bulk_res.json()[1]["entry"]["id"]

    # Delete entry1 with delete_consecutive=False
    del_res = auth_client.delete(f"/api/timetable/entries/{entry1_id}?delete_consecutive=false")
    assert del_res.status_code == 204

    # entry1 should be deleted, but entry2 should still exist
    list_res = auth_client.get("/api/timetable/entries")
    ids = [e["id"] for e in list_res.json()]
    assert entry1_id not in ids
    assert entry2_id in ids


def test_delete_consecutive_stops_at_sort_order_gap(auth_client):
    batch_res = auth_client.post("/api/batches", json={"name": "Gap_Batch"})
    batch_id = batch_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Gap Subject",
        "short_code": "GAP",
    })
    sub_id = sub_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof Gap"})
    fac_id = fac_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Room Gap"})
    room_id = room_res.json()["id"]

    # Slot 1 at order 40, Slot 2 at order 45 (gap in between)
    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Slot Gap 1",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "sort_order": 40,
    })
    slot1_id = slot1_res.json()["id"]

    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Slot Gap 2",
        "start_time": "14:00:00",
        "end_time": "15:00:00",
        "sort_order": 45,
    })
    slot2_id = slot2_res.json()["id"]

    # Create entries in both slots on same day
    e1_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_ids": [fac_id],
        "day": "Monday",
        "time_slot_id": slot1_id,
        "room_id": room_id,
    })
    entry1_id = e1_res.json()["entry"]["id"]

    e2_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_id,
        "faculty_ids": [fac_id],
        "day": "Monday",
        "time_slot_id": slot2_id,
        "room_id": room_id,
    })
    entry2_id = e2_res.json()["entry"]["id"]

    # Delete entry1 with delete_consecutive=True
    del_res = auth_client.delete(f"/api/timetable/entries/{entry1_id}")
    assert del_res.status_code == 204

    # entry1 deleted, but entry2 MUST NOT be deleted because of the gap in sort_order!
    list_res = auth_client.get("/api/timetable/entries")
    ids = [e["id"] for e in list_res.json()]
    assert entry1_id not in ids
    assert entry2_id in ids


