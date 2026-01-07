from internal.app.utils import encode_b64


def test_encode():
    test_id = "test_encode"
    test_secret = "test_secret"
    assert (
        encode_b64(test_id, test_secret) == "dGVzdF9lbmNvZGU6dGVzdF9zZWNyZXQ="
    )
