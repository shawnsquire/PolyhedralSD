$SD.on('connected', conn => connected(conn));

function connected (jsn) {
    debugLog('Connected Plugin:', jsn);

    /** subscribe to the willAppear event */
    $SD.on('com.kaution.polyhedral.action.single.willAppear', jsonObj =>
        singleResultAction.onWillAppear(jsonObj)
    );
    $SD.on('com.kaution.polyhedral.action.single.keyDown', jsonObj =>
        singleResultAction.onKeyDown(jsonObj)
    );
    $SD.on('com.kaution.polyhedral.action.single.keyUp', jsonObj =>
        singleResultAction.onKeyUp(jsonObj)
    );
    $SD.on('com.kaution.polyhedral.action.single.sendToPlugin', jsonObj =>
        singleResultAction.onSendToPlugin(jsonObj)
    );
}

var singleResultAction = {
    type : "com.kaution.polyhedral.action",

    cache: {},
    lastContext: null,
    defaultHandleObj: {
        timer: null,
        canvas: null,
        hadLongPress: false,

        settings: {
            sides: 20,
            count: 1,
            mod: 0,
            type: 'sum',
            result: null
        },
    },

    getHandleObjFromCache: function(context){
        let handleObj = this.cache[context];
        if(handleObj === undefined){
            handleObj = JSON.parse(JSON.stringify(this.defaultHandleObj));
            this.cache[context] = handleObj;
        }
        return handleObj;
    },

    onKeyDown : function(jsonObj) {
        var context = jsonObj.context;
        lastContext = context;
        let handleObj = this.getHandleObjFromCache(context);

        handleObj.timer = setTimeout(function () {
            handleObj.hadLongPress = true;
            singleResultAction.updateSettings(context, {result: null});
            singleResultAction.setDiceRoll(context, null);
        },500);
    },

    onKeyUp : function(jsonObj) {
        var context = jsonObj.context;
        var settings = jsonObj.payload.settings;
        lastContext = context;
        let handleObj = this.getHandleObjFromCache(context);

        clearTimeout(handleObj.timer);

        if(handleObj.hadLongPress){
            handleObj.hadLongPress = false;
            return;
        }

        rolls = [];
        result = 0;
        for (let i = 0; i < handleObj.settings.count; i++) {
            rolls.push(Math.floor(Math.random()*(handleObj.settings.sides)+1));
        }

        rolls.forEach(function(value, index, array) {
            if (handleObj.settings.type == 'sum') {
                result += value;
            } else if (handleObj.settings.type == 'min') {
                result = result > 0 ? Math.min(result, value) : value;
            } else if (handleObj.settings.type == 'max') {
                result = result > 0 ? Math.max(result, value) : value;
            }
        });

        result += handleObj.settings.mod;

        console.log("Rolled a: "+result);

        singleResultAction.updateSettings(context, {result: result});
        this.setDiceRoll(context, result);
    },

    onWillAppear : function(jsonObj) {
        var context = jsonObj.context;
        var settings = jsonObj.payload.settings;
        lastContext = context;
        let handleObj = this.getHandleObjFromCache(context);

        if(settings != null){
            if(settings.hasOwnProperty('result')){
                handleObj.settings.result = settings["result"];
                if(handleObj.settings.result === undefined || isNaN(handleObj.settings.result)){
                    handleObj.settings.result = null;
                }
            }
            if(settings.hasOwnProperty('sides')){
                handleObj.settings.sides = parseInt(settings["sides"]) || 20;
            }
            if(settings.hasOwnProperty('count')){
                handleObj.settings.count = parseInt(settings["count"]) || 1;
            }
            if(settings.hasOwnProperty('mod')){
                handleObj.settings.mod = parseInt(settings["mod"]) || 0;
            }
            if(settings.hasOwnProperty('type')){
                handleObj.settings.type = settings["type"] || "sum";
            }
        }

        this.setDiceRoll(context, handleObj.settings.result);
    },

    onSendToPlugin: function(jsonObj){
        var context = jsonObj.context;
        let handleObj = this.getHandleObjFromCache(context);

        if (jsonObj.payload.hasOwnProperty('DATAREQUEST')) {
            $SD.api.sendToPropertyInspector(
                jsonObj.context,
                {
                    sides: handleObj.settings.sides,
                    count: handleObj.settings.count,
                    mod: handleObj.settings.mod,
                    type: handleObj.settings.type
                },
                this.type
            );
        } else {
            if (jsonObj.payload.hasOwnProperty('sides')) {
                const val = parseInt(jsonObj.payload['sides']) || 20;
                handleObj.settings.sides = val;
            }
            if (jsonObj.payload.hasOwnProperty('count')) {
                const val = parseInt(jsonObj.payload['count']) || 1;
                handleObj.settings.count = val;
            }
            if (jsonObj.payload.hasOwnProperty('mod')) {
                const val = parseInt(jsonObj.payload['mod']) || 0;
                handleObj.settings.mod = val;
            }
            if (jsonObj.payload.hasOwnProperty('type')) {
                const val = jsonObj.payload['type'] || "sum";
                handleObj.settings.type = val;
            }

            singleResultAction.updateSettings(context, {
                sides: handleObj.settings.sides,
                count: handleObj.settings.count,
                mod: handleObj.settings.mod,
                type: handleObj.settings.type
            });
        }
    },

    setDiceRoll : function(context, num){
        let handleObj = this.getHandleObjFromCache(context);

        if(handleObj.canvas === null){
            handleObj.canvas = document.createElement("canvas");
            handleObj.canvas.width = 144;
            handleObj.canvas.height = 144;
            handleObj.canvas.context = context;
        }

        let ctx = handleObj.canvas.getContext("2d");
        ctx.filter = "none";
        ctx.fillStyle = "#0A1423";
        ctx.fillRect(0, 0, handleObj.canvas.width, handleObj.canvas.height);

        if (num == null) {
            let img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 20, 20, handleObj.canvas.width-40, handleObj.canvas.height-40);
                $SD.api.setImage(context, handleObj.canvas.toDataURL());
            };
            img.src = "images/iconPlugin.png";
            return;
        }

        ctx.fillStyle = "#DEDEDE";
        if (handleObj.settings.count == 1 || handleObj.settings.type != 'sum') {
            if (num == 1) {
                ctx.fillStyle = "#df3a4d";
            } else if (num == handleObj.settings.sides + handleObj.settings.mod) {
                ctx.fillStyle = "#3adf3f";
            }
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "52px Arial";
        ctx.fillText(""+num, handleObj.canvas.width/2, handleObj.canvas.height/2);
        $SD.api.setImage(context, handleObj.canvas.toDataURL());
    },

    /* Helper function to set settings while keeping all other fields unchanged */
    updateSettings: function(context, settings){
        let handleObj = this.getHandleObjFromCache(context);
        let updatedSettings = handleObj.settings;

        for(let field in settings){
            updatedSettings[field] = settings[field];
        }

        $SD.api.setSettings(context, updatedSettings);
    }
};