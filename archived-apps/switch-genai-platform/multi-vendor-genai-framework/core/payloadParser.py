# Root method - called from framework.py
def parsePayload(payload, input_var, parserFunction=None):
	if parserFunction is not None:
		return parserFunction(payload, input_var)
	else:
		return "No parser method available to parse prompt."

# Default parser method to extract examples from prompt
def defaultExampleParser(payload, input_var, *args):
	prompt = payload.get(input_var) or ""
	splitted = prompt.split('Input:', 1)
	return f"Input:{splitted[1]}" if len(splitted) > 1 else "Input:\n\nOutput:\n"

# Default parser method to extract instructions from prompt
def defaultInstructionParser(payload, input_var, *args):
	prompt = payload.get(input_var) or ""
	splitted = prompt.split('Input:', 1)
	return f"{splitted[0]}" if len(splitted) > 0 else ""
