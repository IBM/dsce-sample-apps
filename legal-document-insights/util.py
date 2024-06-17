from threading import Thread

# custom thread
class CustomThread(Thread):
    # constructor
    def __init__(self, group=None, target=None, name=None, args=(), kwargs={}, daemon=None):
        # execute the base constructor
        Thread.__init__(self, group, target, name, args, kwargs)
        # set a default values
        self.value1 = None
 
    # function executed in a new thread
    def run(self):
        self.value1 = 'Please provide target function!'
        if self._target is not None:
            self.value1 = self._target(*self._args, **self._kwargs)