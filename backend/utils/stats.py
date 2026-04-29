from collections import deque


class RollingAverage:
    def __init__(self, window: int = 100):
        self.window = window
        self._buffer: deque[float] = deque(maxlen=window)

    def update(self, value: float) -> float:
        self._buffer.append(value)
        return sum(self._buffer) / len(self._buffer)
