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


def test_bulk_create_transactional_rollback_on_conflict(auth_client):
    """If any slot in a bulk lab creation has a conflict, the entire transaction rolls back."""
    batch_res = auth_client.post("/api/batches", json={"name": "Bulk_Rollback_Batch"})
    batch_id = batch_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Network Lab",
        "short_code": "NETLAB",
        "type": "lab",
        "hours_per_week": 3,
    })
    sub_id = sub_res.json()["id"]

    grp_res = auth_client.post(f"/api/batches/{batch_id}/groups", json={"name": "Group A"})
    grp_id = grp_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof Net"})
    fac_id = fac_res.json()["id"]

    room1_res = auth_client.post("/api/rooms", json={"name": "Lab Room 1"})
    room1_id = room1_res.json()["id"]

    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Period 1",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "sort_order": 50,
    })
    slot1_id = slot1_res.json()["id"]

    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Period 2",
        "start_time": "10:00:00",
        "end_time": "11:00:00",
        "sort_order": 51,
    })
    slot2_id = slot2_res.json()["id"]

    # Pre-occupy Period 2 with another batch in Room 1
    other_batch_res = auth_client.post("/api/batches", json={"name": "Other_Batch"})
    other_batch_id = other_batch_res.json()["id"]
    other_sub_res = auth_client.post("/api/subjects", json={
        "batch_id": other_batch_id,
        "name": "Other Sub",
        "short_code": "OTH",
    })
    other_sub_id = other_sub_res.json()["id"]
    other_fac_res = auth_client.post("/api/faculty", json={"name": "Prof Other"})
    other_fac_id = other_fac_res.json()["id"]

    pre_occupy_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": other_batch_id,
        "subject_id": other_sub_id,
        "faculty_ids": [other_fac_id],
        "day": "Wednesday",
        "time_slot_id": slot2_id,
        "room_id": room1_id,
    })
    assert pre_occupy_res.status_code == 201

    # Attempt to bulk create Period 1 + Period 2 for Network Lab
    bulk_res = auth_client.post("/api/timetable/entries/bulk", json=[
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Wednesday",
            "time_slot_id": slot1_id,
            "room_id": room1_id,
        },
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Wednesday",
            "time_slot_id": slot2_id,
            "room_id": room1_id,
        },
    ])
    # Must fail with 409
    assert bulk_res.status_code == 409
    assert "rolled back" in bulk_res.json()["detail"].lower()
    assert "Period 2" in bulk_res.json()["detail"]

    # Verify that Period 1 was NOT created (strict all-or-nothing rollback)
    entries_res = auth_client.get("/api/timetable/entries")
    netlab_entries = [e for e in entries_res.json() if e["subject_id"] == sub_id]
    assert len(netlab_entries) == 0


def test_bulk_create_weekly_limit_enforced(auth_client):
    """Bulk create cannot exceed subject hours_per_week limit."""
    batch_res = auth_client.post("/api/batches", json={"name": "Limit_Batch"})
    batch_id = batch_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Short Lab",
        "short_code": "SHLAB",
        "type": "lab",
        "hours_per_week": 2,
    })
    sub_id = sub_res.json()["id"]

    grp_res = auth_client.post(f"/api/batches/{batch_id}/groups", json={"name": "Group 1"})
    grp_id = grp_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof Limit"})
    fac_id = fac_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Room Limit"})
    room_id = room_res.json()["id"]

    slots = []
    for idx in range(3):
        s_res = auth_client.post("/api/time-slots", json={
            "label": f"Slot L{idx}",
            "start_time": f"{idx+8:02d}:00:00",
            "end_time": f"{idx+9:02d}:00:00",
            "sort_order": 60 + idx,
        })
        assert s_res.status_code == 201
        slots.append(s_res.json()["id"])

    # Try to bulk schedule 3 slots when limit is 2
    bulk_res = auth_client.post("/api/timetable/entries/bulk", json=[
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Monday",
            "time_slot_id": sid,
            "room_id": room_id,
        }
        for sid in slots
    ])
    assert bulk_res.status_code == 409
    assert "allowed lab hours" in bulk_res.json()["detail"].lower()

    # Verify no partial entries created
    entries_res = auth_client.get("/api/timetable/entries")
    shlab_entries = [e for e in entries_res.json() if e["subject_id"] == sub_id]
    assert len(shlab_entries) == 0


def test_update_entry_exceeding_weekly_limit_rejected(auth_client):
    """Updating an entry cannot exceed the subject's weekly hours limit."""
    batch_res = auth_client.post("/api/batches", json={"name": "Update_Limit_Batch"})
    batch_id = batch_res.json()["id"]

    sub_full_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Full Subject",
        "short_code": "FULL",
        "type": "theory",
        "hours_per_week": 1,
    })
    sub_full_id = sub_full_res.json()["id"]

    sub_other_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Other Subject",
        "short_code": "OTHER",
        "type": "theory",
        "hours_per_week": 2,
    })
    sub_other_id = sub_other_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof Upd"})
    fac_id = fac_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Room Upd"})
    room_id = room_res.json()["id"]

    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Slot Upd 1",
        "start_time": "08:00:00",
        "end_time": "09:00:00",
        "sort_order": 70,
    })
    slot1_id = slot1_res.json()["id"]

    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Slot Upd 2",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "sort_order": 71,
    })
    slot2_id = slot2_res.json()["id"]

    # 1. Fill 'Full Subject' to its limit of 1
    e1_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_full_id,
        "faculty_ids": [fac_id],
        "day": "Monday",
        "time_slot_id": slot1_id,
        "room_id": room_id,
    })
    assert e1_res.status_code == 201

    # 2. Create entry for 'Other Subject' in slot 2 (force=true to override back-to-back soft warning)
    e2_res = auth_client.post("/api/timetable/entries?force=true", json={
        "batch_id": batch_id,
        "subject_id": sub_other_id,
        "faculty_ids": [fac_id],
        "day": "Monday",
        "time_slot_id": slot2_id,
        "room_id": room_id,
    })
    assert e2_res.status_code == 201
    entry2 = e2_res.json()["entry"]

    # 3. Try to update entry 2 to 'Full Subject' — should fail because Full Subject already has 1/1 hours
    upd_res = auth_client.put(f"/api/timetable/entries/{entry2['id']}", json={
        "subject_id": sub_full_id,
        "version": entry2["version"],
    })
    assert upd_res.status_code == 409
    assert "exceeds its limit" in upd_res.json()["detail"].lower()


def test_update_entries_bulk_atomic_success(auth_client):
    """PUT /entries/bulk updates all session entries atomically in one transaction."""
    batch_res = auth_client.post("/api/batches", json={"name": "Bulk_Upd_Batch"})
    batch_id = batch_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "OS Lab",
        "short_code": "OSLAB",
        "type": "lab",
        "hours_per_week": 2,
    })
    sub_id = sub_res.json()["id"]

    grp_res = auth_client.post(f"/api/batches/{batch_id}/groups", json={"name": "OS Group"})
    grp_id = grp_res.json()["id"]

    fac1_res = auth_client.post("/api/faculty", json={"name": "Prof Initial"})
    fac1_id = fac1_res.json()["id"]

    fac2_res = auth_client.post("/api/faculty", json={"name": "Prof Replacement"})
    fac2_id = fac2_res.json()["id"]

    room1_res = auth_client.post("/api/rooms", json={"name": "Room Initial"})
    room1_id = room1_res.json()["id"]

    room2_res = auth_client.post("/api/rooms", json={"name": "Room Replacement"})
    room2_id = room2_res.json()["id"]

    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Slot B1",
        "start_time": "10:00:00",
        "end_time": "11:00:00",
        "sort_order": 80,
    })
    slot1_id = slot1_res.json()["id"]

    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Slot B2",
        "start_time": "11:00:00",
        "end_time": "12:00:00",
        "sort_order": 81,
    })
    slot2_id = slot2_res.json()["id"]

    # Create initial 2-period lab session
    create_res = auth_client.post("/api/timetable/entries/bulk", json=[
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac1_id],
            "day": "Tuesday",
            "time_slot_id": slot1_id,
            "room_id": room1_id,
        },
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac1_id],
            "day": "Tuesday",
            "time_slot_id": slot2_id,
            "room_id": room1_id,
        },
    ])
    assert create_res.status_code == 201
    entries = create_res.json()
    e1 = entries[0]["entry"]
    e2 = entries[1]["entry"]
    assert e1["version"] == 1
    assert e2["version"] == 1

    # Bulk update both entries to Room 2 and Faculty 2
    bulk_upd_res = auth_client.put("/api/timetable/entries/bulk", json=[
        {
            "id": e1["id"],
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac2_id],
            "day": "Tuesday",
            "time_slot_id": slot1_id,
            "room_id": room2_id,
            "version": e1["version"],
        },
        {
            "id": e2["id"],
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac2_id],
            "day": "Tuesday",
            "time_slot_id": slot2_id,
            "room_id": room2_id,
            "version": e2["version"],
        },
    ])
    assert bulk_upd_res.status_code == 200
    updated_entries = bulk_upd_res.json()
    assert len(updated_entries) == 2
    for u in updated_entries:
        assert u["entry"]["room"]["id"] == room2_id
        assert [f["id"] for f in u["entry"]["faculties"]] == [fac2_id]
        assert u["entry"]["version"] == 2


def test_update_entries_bulk_atomic_rollback_on_conflict(auth_client):
    """If one entry in PUT /entries/bulk conflicts, all updates roll back without partial version bumps."""
    batch_res = auth_client.post("/api/batches", json={"name": "Bulk_Rollback_Upd_Batch"})
    batch_id = batch_res.json()["id"]

    sub_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Web Lab",
        "short_code": "WEBLAB",
        "type": "lab",
        "hours_per_week": 2,
    })
    sub_id = sub_res.json()["id"]

    grp_res = auth_client.post(f"/api/batches/{batch_id}/groups", json={"name": "Web Group"})
    grp_id = grp_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof Web"})
    fac_id = fac_res.json()["id"]

    room1_res = auth_client.post("/api/rooms", json={"name": "Room Web 1"})
    room1_id = room1_res.json()["id"]

    room2_res = auth_client.post("/api/rooms", json={"name": "Room Web 2"})
    room2_id = room2_res.json()["id"]

    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Slot W1",
        "start_time": "13:00:00",
        "end_time": "14:00:00",
        "sort_order": 90,
    })
    slot1_id = slot1_res.json()["id"]

    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Slot W2",
        "start_time": "14:00:00",
        "end_time": "15:00:00",
        "sort_order": 91,
    })
    slot2_id = slot2_res.json()["id"]

    # Create 2-period lab in Room 1
    create_res = auth_client.post("/api/timetable/entries/bulk", json=[
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Wednesday",
            "time_slot_id": slot1_id,
            "room_id": room1_id,
        },
        {
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Wednesday",
            "time_slot_id": slot2_id,
            "room_id": room1_id,
        },
    ])
    entries = create_res.json()
    e1 = entries[0]["entry"]
    e2 = entries[1]["entry"]

    # Pre-occupy Room 2 at Slot W2 with another batch
    blocker_batch = auth_client.post("/api/batches", json={"name": "Blocker_Batch"}).json()["id"]
    blocker_sub = auth_client.post("/api/subjects", json={"batch_id": blocker_batch, "name": "BSub", "short_code": "BS"}).json()["id"]
    blocker_fac = auth_client.post("/api/faculty", json={"name": "Prof Blocker"}).json()["id"]
    auth_client.post("/api/timetable/entries", json={
        "batch_id": blocker_batch,
        "subject_id": blocker_sub,
        "faculty_ids": [blocker_fac],
        "day": "Wednesday",
        "time_slot_id": slot2_id,
        "room_id": room2_id,
    })

    # Attempt to bulk-update both entries to Room 2 — Slot W2 will conflict!
    bulk_upd_res = auth_client.put("/api/timetable/entries/bulk", json=[
        {
            "id": e1["id"],
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Wednesday",
            "time_slot_id": slot1_id,
            "room_id": room2_id,
            "version": e1["version"],
        },
        {
            "id": e2["id"],
            "batch_id": batch_id,
            "group_id": grp_id,
            "subject_id": sub_id,
            "faculty_ids": [fac_id],
            "day": "Wednesday",
            "time_slot_id": slot2_id,
            "room_id": room2_id,
            "version": e2["version"],
        },
    ])
    assert bulk_upd_res.status_code == 409
    assert "rolled back" in bulk_upd_res.json()["detail"].lower()
    assert "Slot W2" in bulk_upd_res.json()["detail"]

    # Read back entries and verify neither e1 nor e2 was modified
    entries_res = auth_client.get(f"/api/timetable/entries?batch_id={batch_id}")
    assert entries_res.status_code == 200
    entries_by_id = {e["id"]: e for e in entries_res.json()}

    assert entries_by_id[e1["id"]]["room_id"] == room1_id
    assert entries_by_id[e1["id"]]["version"] == e1["version"]
    assert entries_by_id[e2["id"]]["room_id"] == room1_id
    assert entries_by_id[e2["id"]]["version"] == e2["version"]


def test_consecutive_faculty_warning_same_batch_different_subjects(auth_client):
    """Faculty teaching different subjects in consecutive periods of the same batch should trigger a soft warning."""
    batch_res = auth_client.post("/api/batches", json={"name": "Consec_Batch"})
    batch_id = batch_res.json()["id"]

    sub_theory_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Theory Sub",
        "short_code": "TH1",
        "type": "theory",
        "hours_per_week": 3,
    })
    sub_theory_id = sub_theory_res.json()["id"]

    sub_lab_res = auth_client.post("/api/subjects", json={
        "batch_id": batch_id,
        "name": "Lab Sub",
        "short_code": "LB1",
        "type": "lab",
        "hours_per_week": 2,
    })
    sub_lab_id = sub_lab_res.json()["id"]

    grp_res = auth_client.post(f"/api/batches/{batch_id}/groups", json={"name": "G1"})
    grp_id = grp_res.json()["id"]

    fac_res = auth_client.post("/api/faculty", json={"name": "Prof Consec"})
    fac_id = fac_res.json()["id"]

    room_res = auth_client.post("/api/rooms", json={"name": "Room Consec"})
    room_id = room_res.json()["id"]

    slot1_res = auth_client.post("/api/time-slots", json={
        "label": "Period 1",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "sort_order": 100,
    })
    slot1_id = slot1_res.json()["id"]

    slot2_res = auth_client.post("/api/time-slots", json={
        "label": "Period 2",
        "start_time": "10:00:00",
        "end_time": "11:00:00",
        "sort_order": 101,
    })
    slot2_id = slot2_res.json()["id"]

    # 1. Book Period 1 for Theory Sub with Prof Consec
    p1_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "subject_id": sub_theory_id,
        "faculty_ids": [fac_id],
        "day": "Monday",
        "time_slot_id": slot1_id,
        "room_id": room_id,
    })
    assert p1_res.status_code == 201

    # 2. Attempt to book Period 2 for Lab Sub with the same Prof Consec in the same batch without force
    p2_res = auth_client.post("/api/timetable/entries", json={
        "batch_id": batch_id,
        "group_id": grp_id,
        "subject_id": sub_lab_id,
        "faculty_ids": [fac_id],
        "day": "Monday",
        "time_slot_id": slot2_id,
        "room_id": room_id,
    })
    # Must return a 200 soft warning
    assert p2_res.status_code == 200
    p2_data = p2_res.json()
    assert p2_data["status"] == "warning"
    assert "back to back" in p2_data["message"].lower()

    # 3. With force=True, it should allow the override
    p2_force_res = auth_client.post("/api/timetable/entries?force=true", json={
        "batch_id": batch_id,
        "group_id": grp_id,
        "subject_id": sub_lab_id,
        "faculty_ids": [fac_id],
        "day": "Monday",
        "time_slot_id": slot2_id,
        "room_id": room_id,
    })
    assert p2_force_res.status_code == 201
    assert p2_force_res.json()["entry"]["id"] is not None





