const ctx = {
	name: "unknown",
	version: "unknown",
	description: null,
	options: {},
	optionsShort: {},
	commands: {},
	flags: {},
	numOptions: 0
};

function RequiredArg(value) {
	this.value = value;
}

function OptionalArg(value) {
	this.value = value;
}

function Option(actionArgs, description, onFunc)
{
	const buffer = actionArgs.split(" ");
	const num = buffer.length;

	this.shortName = buffer[0].slice(1, buffer[0].length - 1);
	this.name = buffer[1].slice(2);
	this.description = description;
	this.onFunc = onFunc;
	
	const numArgs = buffer.length - 2;
	this.args = new Array(numArgs);
	if(numArgs === 0) { return; }

	for(let n = 2; n < numArgs + 2; n++) 
	{
		const arg = buffer[n];
		const argStr = arg.slice(1, arg.length - 1);
		let argObj = null;

		if(arg[0] === "[" && arg[arg.length - 1] === "]") {
			argObj = new OptionalArg(argStr);
		}
		else if(arg[0] === "<" && arg[arg.length - 1] === ">") {
			argObj = new RequiredArg(argStr);
		}
		else {
			argObj = null;
			console.warn("(cli.Option) Invalid argument defined: " + arg);
		}

		this.args[n - 2] = argObj;
	}
}

function Command(argStr, description, onFunc)
{
	const buffer = argStr.split(" ");
	const num = buffer.length;

	this.name = buffer[0];
	this.argStr = argStr;
	this.description = description;
	this.onFunc = onFunc || null;
	
	const numArgs = buffer.length - 1;
	this.args = new Array(numArgs);
	this.minArgs = 0;
	if(numArgs === 0) { return; }

	for(let n = 1; n < numArgs + 1; n++) 
	{
		const arg = buffer[n];
		const argStr = arg.slice(1, arg.length - 1);
		let argObj = null;

		if(arg[0] === "[" && arg[arg.length - 1] === "]") {
			argObj = new OptionalArg(argStr);
		}
		else if(arg[0] === "<" && arg[arg.length - 1] === ">") {
			argObj = new RequiredArg(argStr);
			this.minArgs = n;
		}
		else {
			argObj = null;
			console.warn("(cli.Option) Invalid argument defined: " + arg);
		}

		this.args[n - 1] = argObj;
	}
}


function name(name) {
	ctx.name = name;
	return module.exports;
}

function version(version) {
	ctx.version = version;
	return module.exports;
}

function description(description) {
	ctx.description = description;
	return module.exports;
}

function option(argStr, description, cbFunc) {
	const action = new Option(argStr, description, cbFunc);
	ctx.options[action.name] = action;
	ctx.optionsShort[action.shortName] = action;
	return module.exports;
}

function command(argStr, description, onFunc) {
	const action = new Command(argStr, description, onFunc);
	ctx.commands[action.name] = action;
	return module.exports;
}

function parse(argv, runFunc)
{
	const args = argv.slice(2);
	const numArgs = args.length;

	if(parseCommand(args.slice(0))) { return; }

	if(parseNormal(args.slice(0))) { 
		runFunc(args[0]);
		return; 
	}

	help();
}

function parseNormal(args)
{
	if(args.length === 0) { return false; }

	for(let n = 1; n < args.length; n++) 
	{
		const arg = args[n];
		if(arg[0] !== "-") {
			console.error("Error: Invalid argument passed: " + arg);
			return true;
		}

		const index = arg.lastIndexOf("-");
		const name = arg.slice(index + 1);

		const option = (index === 0) ? ctx.optionsShort[name] : ctx.options[name];
		if(!option) {
			console.error("Error: Unknown option used: " + name);
			return true;
		}

		n = parseOption(option, args, n);
	}

	return true;
}

function parseOption(option, args, n)
{
	const flags = {};
	const params = [];

	for(let i = 0; i < option.args.length; i++) 
	{
		if(n === args.length - 1) { break; }
	
		n++;
		const arg = args[n];
		if(arg.indexOf("-") === 0) { 
			n--; 
			break; 
		}	

		const optionArg = option.args[i];
		switch(optionArg.value)
		{
			case "file":
			case "dir":
			{
				if(!isNaN(arg)) {
					console.error(`Expected string for '${option.name}' parameter (${i + 1})`);
					return n;
				}

				params.push(arg);
				flags[optionArg.value] = arg;
			} break;

			case "port":
			case "httpPort":
			case "wsPort":
			{
				if(isNaN(arg)) {
					console.error(`Expected number for '${option.name}' parameter (${i + 1})`);
					return n;
				}

				const param = parseInt(arg);
				params.push(param);
				flags[optionArg.value] = param;
			} break;

			default:
				params.push(arg);
				flags[optionArg.value] = arg;
				break;
		}
	}

	ctx.flags[option.name] = flags;

	if(option.onFunc) {
		option.onFunc.apply(this, params);
	}

	return n;
}

function parseCommand(args)
{
	const command = ctx.commands[args.shift()];
	if(!command) { return false; }

	if(args.length < command.minArgs) { 
		console.log("");
		console.log("Not enough params are passed, expected:");
		console.log(`\t${ctx.name} ${command.argStr}`);
		return true;
	}

	if(command.onFunc)
	{
		const buffer = [];

		for(let n = 0; n < command.args.length; n++) 
		{
			const arg = command.args[n];
			buffer.push(args[n]);
		}

		command.onFunc.apply(this, buffer);
	}

	return true;
}

function help()
{
	const usages = ctx.usages;

	console.log(ctx.description);
	console.log("");

	console.log("Usage:");
	console.log(`\t${ctx.name} <file> [options]`);
	console.log(`\t${ctx.name} <command>`);

	console.log("");
	console.log("Options:");
	for(const key in ctx.options) {
		const option = ctx.options[key];
		console.log(`\t-${option.shortName}, ${option.name}\t\t${option.description}`);
	}

	console.log("");
	console.log("Commands:");
	for(const key in ctx.commands) {
		const cmd = ctx.commands[key];
		console.log(`\t${cmd.argStr}\t\t${cmd.description}`);
	}
}

module.exports = {
	name, version, description, option, command, parse, help, flags: ctx.flags
};
