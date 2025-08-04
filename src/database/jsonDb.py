import os
import hashlib
import jsonpickle


class JsonDB:
    """
    Simple JSON file database with circular reference support.
    """

    def __init__(self, directory: str):
        """
        Create a new JsonDB instance.
        :param directory: Directory to store JSON files.
        """
        self.directory = directory
        os.makedirs(self.directory, exist_ok=True)

    def _hash(self, id: str) -> str:
        """
        Generate an MD5 hash for the given id.
        :param id: The input string to hash.
        :return: The MD5 hash of the id.
        """
        return hashlib.md5(id.encode("utf-8")).hexdigest()

    def save(self, id: str, data):
        """
        Save data to a JSON file with the given id.
        :param id: Identifier for the JSON file (without extension).
        :param data: Data to save (can include circular references).
        """
        hashed_id = self._hash(id)
        save_path = os.path.join(self.directory, f"{hashed_id}.json")
        encoded = jsonpickle.encode(data, make_refs=True)
        if isinstance(encoded, str):
            with open(save_path, "w", encoding="utf-8") as f:
                f.write(encoded)

    def load(self, id: str):
        """
        Load data from a JSON file with the given id.
        :param id: Identifier for the JSON file (without extension).
        :return: The parsed data (with circular references restored).
        """
        hashed_id = self._hash(id)
        load_path = os.path.join(self.directory, f"{hashed_id}.json")
        if not os.path.exists(load_path):
            raise FileNotFoundError(f"No JSON file found for id '{id}'")
        with open(load_path, "r", encoding="utf-8") as f:
            return jsonpickle.decode(f.read())

    def delete(self, id: str):
        """
        Delete a JSON file with the given id.
        :param id: Identifier for the JSON file (without extension).
        """
        hashed_id = self._hash(id)
        delete_path = os.path.join(self.directory, f"{hashed_id}.json")
        if os.path.exists(delete_path):
            os.remove(delete_path)
