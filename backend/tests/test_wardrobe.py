"""Tests for the wardrobe router using a mocked Supabase client."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models.user import UserContext

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

USER_ID = str(uuid4())
ITEM_ID = str(uuid4())

NOW = datetime.now(tz=timezone.utc).isoformat()

SAMPLE_ITEM = {
    "id": ITEM_ID,
    "user_id": USER_ID,
    "name": "White T-Shirt",
    "category": "top",
    "subcategory": None,
    "attributes": {},
    "original_url": "https://storage.example.com/originals/item.jpg",
    "segmented_url": "https://storage.example.com/segmented/item.png",
    "thumbnail_url": "https://storage.example.com/thumbnails/item.jpg",
    "clip_confidence": 0.92,
    "created_at": NOW,
    "updated_at": NOW,
}


@pytest.fixture()
def mock_user() -> UserContext:
    return UserContext(id=USER_ID, email="test@example.com")


@pytest.fixture()
def mock_supabase() -> MagicMock:
    """Return a MagicMock that mimics supabase-py's chainable query builder."""
    client = MagicMock()

    # Build a fluent chain: .table().select().eq().eq().order().range().execute()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.range.return_value = chain
    chain.maybe_single.return_value = chain
    chain.update.return_value = chain
    chain.delete.return_value = chain

    client.table.return_value = chain
    return client


@pytest.fixture()
def client(mock_user: UserContext, mock_supabase: MagicMock) -> TestClient:
    app = create_app()

    # Override auth dependency so every request is authenticated as mock_user
    from app.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_user

    # Patch the Supabase client used by the wardrobe router
    with patch("app.routers.wardrobe.get_supabase_client", return_value=mock_supabase):  # noqa: SIM117
        with patch("app.services.segmentation.load_rembg_session"):
            with patch("app.services.classification.load_clip_model"):
                yield TestClient(app)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestListWardrobeItems:
    def test_returns_empty_list_when_no_items(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value.data = (
            []
        )

        response = client.get("/api/v1/wardrobe")

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_list_of_items(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        chain = mock_supabase.table.return_value
        # Walk the chain down to the final .execute()
        for attr in ("select", "eq", "eq", "order", "range"):
            chain = getattr(chain, attr).return_value
        chain.execute.return_value.data = [SAMPLE_ITEM]

        response = client.get("/api/v1/wardrobe")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == ITEM_ID
        assert data[0]["name"] == "White T-Shirt"
        assert data[0]["category"] == "top"

    def test_pagination_params_are_forwarded(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        chain = mock_supabase.table.return_value
        for attr in ("select", "eq", "eq", "order", "range"):
            chain = getattr(chain, attr).return_value
        chain.execute.return_value.data = []

        response = client.get("/api/v1/wardrobe?page=2&limit=5")

        assert response.status_code == 200
        # Verify .range() was called with the correct offset
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.range.assert_called_once_with(
            5, 9
        )

    def test_category_filter_is_applied(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        chain = mock_supabase.table.return_value
        for attr in ("select", "eq", "eq", "eq", "order", "range"):
            chain = getattr(chain, attr).return_value
        chain.execute.return_value.data = []

        response = client.get("/api/v1/wardrobe?category=top")

        assert response.status_code == 200


class TestGetWardrobeItem:
    def test_returns_item_when_found(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        chain = mock_supabase.table.return_value
        for attr in ("select", "eq", "eq", "maybe_single"):
            chain = getattr(chain, attr).return_value
        chain.execute.return_value.data = SAMPLE_ITEM

        response = client.get(f"/api/v1/wardrobe/{ITEM_ID}")

        assert response.status_code == 200
        assert response.json()["id"] == ITEM_ID

    def test_returns_404_when_not_found(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        chain = mock_supabase.table.return_value
        for attr in ("select", "eq", "eq", "maybe_single"):
            chain = getattr(chain, attr).return_value
        chain.execute.return_value.data = None

        response = client.get(f"/api/v1/wardrobe/{uuid4()}")

        assert response.status_code == 404


class TestUpdateWardrobeItem:
    def test_updates_name_successfully(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        updated_item = {**SAMPLE_ITEM, "name": "Black T-Shirt"}

        # First call: ownership check (.select().eq().eq().maybe_single().execute())
        ownership_chain = MagicMock()
        ownership_chain.execute.return_value.data = {"id": ITEM_ID}

        # Second call: update (.update().eq().eq().execute())
        update_chain = MagicMock()
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value.data = [updated_item]

        table_mock = MagicMock()
        select_chain = MagicMock()
        select_chain.eq.return_value = select_chain
        select_chain.maybe_single.return_value = ownership_chain
        table_mock.select.return_value = select_chain
        table_mock.update.return_value = update_chain

        mock_supabase.table.return_value = table_mock

        response = client.patch(
            f"/api/v1/wardrobe/{ITEM_ID}", json={"name": "Black T-Shirt"}
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Black T-Shirt"

    def test_returns_404_when_item_missing(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        chain = mock_supabase.table.return_value
        for attr in ("select", "eq", "eq", "maybe_single"):
            chain = getattr(chain, attr).return_value
        chain.execute.return_value.data = None

        response = client.patch(
            f"/api/v1/wardrobe/{uuid4()}", json={"name": "New Name"}
        )

        assert response.status_code == 404


class TestDeleteWardrobeItem:
    def test_deletes_item_successfully(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        # Fetch call returns the item; delete call returns nothing
        fetch_chain = MagicMock()
        fetch_chain.execute.return_value.data = SAMPLE_ITEM

        delete_chain = MagicMock()
        delete_chain.eq.return_value = delete_chain
        delete_chain.execute.return_value.data = []

        table_mock = MagicMock()
        select_chain = MagicMock()
        select_chain.eq.return_value = select_chain
        select_chain.maybe_single.return_value = fetch_chain
        table_mock.select.return_value = select_chain
        table_mock.delete.return_value = delete_chain

        mock_supabase.table.return_value = table_mock

        with patch("app.routers.wardrobe.get_storage_service") as mock_storage:
            mock_storage.return_value.delete = MagicMock(return_value=None)
            response = client.delete(f"/api/v1/wardrobe/{ITEM_ID}")

        assert response.status_code == 204

    def test_returns_404_when_item_missing(
        self, client: TestClient, mock_supabase: MagicMock
    ) -> None:
        chain = mock_supabase.table.return_value
        for attr in ("select", "eq", "eq", "maybe_single"):
            chain = getattr(chain, attr).return_value
        chain.execute.return_value.data = None

        response = client.delete(f"/api/v1/wardrobe/{uuid4()}")

        assert response.status_code == 404
