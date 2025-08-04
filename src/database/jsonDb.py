import os
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

    def save(self, id: str, data):
        """
        Save data to a JSON file with the given id.
        :param id: Identifier for the JSON file (without extension).
        :param data: Data to save (can include circular references).
        """
        save_path = os.path.join(self.directory, f"{id}.json")
        with open(save_path, "w", encoding="utf-8") as f:
            encoded = jsonpickle.encode(data, make_refs=True)
            if isinstance(encoded, str):
                f.write(encoded)

    def load(self, id: str):
        """
        Load data from a JSON file with the given id.
        :param id: Identifier for the JSON file (without extension).
        :return: The parsed data (with circular references restored).
        """
        load_path = os.path.join(self.directory, f"{id}.json")
        if not os.path.exists(load_path):
            raise FileNotFoundError(f"No JSON file found for id '{id}'")
        with open(load_path, "r", encoding="utf-8") as f:
            return jsonpickle.decode(f.read())

    def delete(self, id: str):
        """
        Delete a JSON file with the given id.
        :param id: Identifier for the JSON file (without extension).
        """
        delete_path = os.path.join(self.directory, f"{id}.json")
        if os.path.exists(delete_path):
            os.remove(delete_path)
