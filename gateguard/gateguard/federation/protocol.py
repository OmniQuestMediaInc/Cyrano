import json
from typing import Dict, Any
from cryptography.hazmat.primitives.asymmetric import ed25519


class FederationProtocol:
    def __init__(self):
        self.private_key = ed25519.Ed25519PrivateKey.generate()
        self.public_key = self.private_key.public_key()

    def sign_update(self, update: Dict[str, Any]) -> Dict[str, Any]:
        payload = json.dumps(update, sort_keys=True).encode()
        signature = self.private_key.sign(payload)
        update["signature"] = signature.hex()
        return update

    def verify_update(self, update: Dict[str, Any]) -> bool:
        signature_hex = update.pop("signature", None)
        if not signature_hex:
            return False
        payload = json.dumps(update, sort_keys=True).encode()
        signature = bytes.fromhex(signature_hex)
        try:
            self.public_key.verify(signature, payload)
            update["signature"] = signature_hex
            return True
        except Exception:
            update["signature"] = signature_hex
            return False
