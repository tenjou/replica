const fs = require("fs");
const path = require("path");
const FSEvent = process.binding("fs_event_wrap").FSEvent;

const watchingDirs = {};
let onEventFunc = null;

class WatchFile
{
    constructor(file) {
        this.file = file;
        this.count = 0;
    }
}

class WatchDirectory
{
    constructor(src, handle) 
    {
        this.src = src;
        this.handle = handle;

        this.files = {};
        this.count = 0;
    }

    destroy() {
        this.handle.close();
        delete this.watchingDirs[this.src];
    }

    watchFile(file) 
    {
        let watchFile = this.files[file.filename];
        if(!watchFile) {
            watchFile = new WatchFile(file);
            this.files[file.filename] = watchFile;

            // console.log("WATCH_FILE:", file.rootPath + file.filename);
        }

        watchFile.count++;
        this.count++;
    }

    unwatchFile(file) 
    {
        let watchFile = this.files[file.filename];
        if(!watchFile) {
            console.error("(WatchDirectory.unwatchFile) No such file is being watched: " + fullSrc);
            return;
        }

        watchFile.count--;
        if(watchFile.count === 0) {
            delete this.files[fullSrc];
        }

        this.count--;
        if(this.count === 0) {
            this.destroy();
        }
    }
}

function watchFile(file)
{
    let dir = watchingDirs[file.rootPath];
    if(!dir) 
    {
        const slash = path.normalize("/");

        let handle = new FSEvent();

        dir = new WatchDirectory(file.rootPath, handle);
        watchingDirs[file.rootPath] = dir;

        handle.onchange = function(status, eventType, filename) {
            if(filename[0] === slash) {
                filename = filename.slice(1);
            }
            watchDirectoryFunc(eventType, dir, filename);
        };
        handle.start(file.rootPath);

        // console.log("WATCH_DIR:", file.rootPath);
    }

    dir.watchFile(file);
}

function unwatchFile(file)
{
    let dir = watchingDirs[file.rootPath];
    if(!dir) {
        console.error("(unwatchFile) Directory is not being watched: " + file.rootPath);
        return;
    }

    dir.unwatchFile(file);
}

function setEventListener(func) {
    onEventFunc = func;
}

function watchDirectoryFunc(eventType, dir, filename)
{
    if(!onEventFunc) { return; }

    const fileWatch = dir.files[filename];
    if(!fileWatch) { return; }

    const file = fileWatch.file;
    const fullSrc = dir.src + filename.slice(1);
	const fileExist = fs.existsSync(fullSrc);
	
	switch(eventType) 
	{
		case "rename":
		{
			if(!fileExist) 
			{

				console.log(eventType, "file-removed", filename)
				// if(watching[fullSrc]) {
				// 	removeDirectory(input, fullSrc);
				// }
				// else {
				// 	removeSource(input, fullSrc);
				// }
			}
		} break;

		case "change":
            onEventFunc("update", dir, file);
		    break;
	}
}


module.exports = {
   watchFile, unwatchFile, setEventListener
};
