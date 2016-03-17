/* A Minimalistic Wrapper for IndexedDB
   ====================================

   By David Fahlander, david.fahlander@gmail.com

   Version 1.2.0 - September 22, 2015.

   Tested successfully on Chrome, Opera, Firefox, Edge, and IE.

   Official Website: www.dexie.com

   Licensed under the Apache License Version 2.0, January 2004, http://www.apache.org/licenses/
*/
(function (global, publish, undefined) {

    "use strict";

    function extend(obj, extension) {
        if (typeof extension !== 'object') extension = extension(); // Allow to supply a function returning the extension. Useful for simplifying private scopes.
        Object.keys(extension).forEach(function (key) {
            obj[key] = extension[key];
        });
        return obj;
    }

    function derive(Child) {
        return {
            from: function (Parent) {
                Child.prototype = Object.create(Parent.prototype);
                Child.prototype.constructor = Child;
                return {
                    extend: function (extension) {
                        extend(Child.prototype, typeof extension !== 'object' ? extension(Parent.prototype) : extension);
                    }
                };
            }
        };
    }

    function override(origFunc, overridedFactory) {
        return overridedFactory(origFunc);
    }

    function Dexie(dbName, options) {
        /// <param name="options" type="Object" optional="true">Specify only if you wich to control which addons that should run on this instance</param>
        var addons = (options && options.addons) || Dexie.addons;
        // Resolve all external dependencies:
        var deps = Dexie.dependencies;
        var indexedDB = deps.indexedDB,
            IDBKeyRange = deps.IDBKeyRange,
            IDBTransaction = deps.IDBTransaction;

        var DOMError = deps.DOMError,
            TypeError = deps.TypeError,
            Error = deps.Error;

        var globalSchema = this._dbSchema = {};
        var versions = [];
        var dbStoreNames = [];
        var allTables = {};
        var notInTransFallbackTables = {};
        ///<var type="IDBDatabase" />
        var idbdb = null; // Instance of IDBDatabase
        var db_is_blocked = true;
        var dbOpenError = null;
        var isBeingOpened = false;
        var READONLY = "readonly", READWRITE = "readwrite";
        var db = this;
        var pausedResumeables = [];
        var autoSchema = true;
        var hasNativeGetDatabaseNames = !!getNativeGetDatabaseNamesFn();

        function init() {
            // If browser (not node.js or other), subscribe to versionchange event and reload page
            db.on("versionchange", function (ev) {
                // Default behavior for versionchange event is to close database connection.
                // Caller can override this behavior by doing db.on("versionchange", function(){ return false; });
                // Let's not block the other window from making it's delete() or open() call.
                db.close();
                db.on('error').fire(new Error("Database version changed by other database connection."));
                // In many web applications, it would be recommended to force window.reload()
                // when this event occurs. Do do that, subscribe to the versionchange event
                // and call window.location.reload(true);
            });
        }

        //
        //
        //
        // ------------------------- Versioning Framework---------------------------
        //
        //
        //

        this.version = function (versionNumber) {
            /// <param name="versionNumber" type="Number"></param>
            /// <returns type="Version"></returns>
            if (idbdb) throw new Error("Cannot add version when database is open");
            this.verno = Math.max(this.verno, versionNumber);
            var versionInstance = versions.filter(function (v) { return v._cfg.version === versionNumber; })[0];
            if (versionInstance) return versionInstance;
            versionInstance = new Version(versionNumber);
            versions.push(versionInstance);
            versions.sort(lowerVersionFirst);
            return versionInstance;
        }; 

        function Version(versionNumber) {
            this._cfg = {
                version: versionNumber,
                storesSource: null,
                dbschema: {},
                tables: {},
                contentUpgrade: null
            }; 
            this.stores({}); // Derive earlier schemas by default.
        }

        extend(Version.prototype, {
            stores: function (stores) {
                /// <summary>
                ///   Defines the schema for a particular version
                /// </summary>
                /// <param name="stores" type="Object">
                /// Example: <br/>
                ///   {users: "id++,first,last,&amp;username,*email", <br/>
                ///   passwords: "id++,&amp;username"}<br/>
                /// <br/>
                /// Syntax: {Table: "[primaryKey][++],[&amp;][*]index1,[&amp;][*]index2,..."}<br/><br/>
                /// Special characters:<br/>
                ///  "&amp;"  means unique key, <br/>
                ///  "*"  means value is multiEntry, <br/>
                ///  "++" means auto-increment and only applicable for primary key <br/>
                /// </param>
                this._cfg.storesSource = this._cfg.storesSource ? extend(this._cfg.storesSource, stores) : stores;

                // Derive stores from earlier versions if they are not explicitely specified as null or a new syntax.
                var storesSpec = {};
                versions.forEach(function (version) { // 'versions' is always sorted by lowest version first.
                    extend(storesSpec, version._cfg.storesSource);
                });

                var dbschema = (this._cfg.dbschema = {});
                this._parseStoresSpec(storesSpec, dbschema);
                // Update the latest schema to this version
                // Update API
                globalSchema = db._dbSchema = dbschema;
                removeTablesApi([allTables, db, notInTransFallbackTables]);
                setApiOnPlace([notInTransFallbackTables], tableNotInTransaction, Object.keys(dbschema), READWRITE, dbschema);
                setApiOnPlace([allTables, db, this._cfg.tables], db._transPromiseFactory, Object.keys(dbschema), READWRITE, dbschema, true);
                dbStoreNames = Object.keys(dbschema);
                return this;
            },
            upgrade: function (upgradeFunction) {
                /// <param name="upgradeFunction" optional="true">Function that performs upgrading actions.</param>
                var self = this;
                fakeAutoComplete(function () {
                    upgradeFunction(db._createTransaction(READWRITE, Object.keys(self._cfg.dbschema), self._cfg.dbschema));// BUGBUG: No code completion for prev version's tables wont appear.
                });
                this._cfg.contentUpgrade = upgradeFunction;
                return this;
            },
            _parseStoresSpec: function (stores, outSchema) {
                Object.keys(stores).forEach(function (tableName) {
                    if (stores[tableName] !== null) {
                        var instanceTemplate = {};
                        var indexes = parseIndexSyntax(stores[tableName]);
                        var primKey = indexes.shift();
                        if (primKey.multi) throw new Error("Primary key cannot be multi-valued");
                        if (primKey.keyPath) setByKeyPath(instanceTemplate, primKey.keyPath, primKey.auto ? 0 : primKey.keyPath);
                        indexes.forEach(function (idx) {
                            if (idx.auto) throw new Error("Only primary key can be marked as autoIncrement (++)");
                            if (!idx.keyPath) throw new Error("Index must have a name and cannot be an empty string");
                            setByKeyPath(instanceTemplate, idx.keyPath, idx.compound ? idx.keyPath.map(function () { return ""; }) : "");
                        });
                        outSchema[tableName] = new TableSchema(tableName, primKey, indexes, instanceTemplate);
                    }
                });
            }
        });

        function runUpgraders(oldVersion, idbtrans, reject, openReq) {
            if (oldVersion === 0) {
                //globalSchema = versions[versions.length - 1]._cfg.dbschema;
                // Create tables:
                Object.keys(globalSchema).forEach(function (tableName) {
                    createTable(idbtrans, tableName, globalSchema[tableName].primKey, globalSchema[tableName].indexes);
                });
                // Populate data
                var t = db._createTransaction(READWRITE, dbStoreNames, globalSchema);
                t.idbtrans = idbtrans;
                t.idbtrans.onerror = eventRejectHandler(reject, ["populating database"]);
                t.on('error').subscribe(reject);
                Promise.newPSD(function () {
                    Promise.PSD.trans = t;
                    try {
                        db.on("populate").fire(t);
                    } catch (err) {
                        openReq.onerror = idbtrans.onerror = function (ev) { ev.preventDefault(); };  // Prohibit AbortError fire on db.on("error") in Firefox.
                        try { idbtrans.abort(); } catch (e) { }
                        idbtrans.db.close();
                        reject(err);
                    }
                });
            } else {
                // Upgrade version to version, step-by-step from oldest to newest version.
                // Each transaction object will contain the table set that was current in that version (but also not-yet-deleted tables from its previous version)
                var queue = [];
                var oldVersionStruct = versions.filter(function (version) { return version._cfg.version === oldVersion; })[0];
                if (!oldVersionStruct) throw new Error("Dexie specification of currently installed DB version is missing");
                globalSchema = db._dbSchema = oldVersionStruct._cfg.dbschema;
                var anyContentUpgraderHasRun = false;

                var versToRun = versions.filter(function (v) { return v._cfg.version > oldVersion; });
                versToRun.forEach(function (version) {
                    /// <param name="version" type="Version"></param>
                    var oldSchema = globalSchema;
                    var newSchema = version._cfg.dbschema;
                    adjustToExistingIndexNames(oldSchema, idbtrans);
                    adjustToExistingIndexNames(newSchema, idbtrans);
                    globalSchema = db._dbSchema = newSchema;
                    {
                        var diff = getSchemaDiff(oldSchema, newSchema);
                        diff.add.forEach(function (tuple) {
                            queue.push(function (idbtrans, cb) {
                                createTable(idbtrans, tuple[0], tuple[1].primKey, tuple[1].indexes);
                                cb();
                            });
                        });
                        diff.change.forEach(function (change) {
                            if (change.recreate) {
                                throw new Error("Not yet support for changing primary key");
                            } else {
                                queue.push(function (idbtrans, cb) {
                                    var store = idbtrans.objectStore(change.name);
                                    change.add.forEach(function (idx) {
                                        addIndex(store, idx);
                                    });
                                    change.change.forEach(function (idx) {
                                        store.deleteIndex(idx.name);
                                        addIndex(store, idx);
                                    });
                                    change.del.forEach(function (idxName) {
                                        store.deleteIndex(idxName);
                                    });
                                    cb();
                                });
                            }
                        });
                        if (version._cfg.contentUpgrade) {
                            queue.push(function (idbtrans, cb) {
                                anyContentUpgraderHasRun = true;
                                var t = db._createTransaction(READWRITE, [].slice.call(idbtrans.db.objectStoreNames, 0), newSchema);
                                t.idbtrans = idbtrans;
                                var uncompletedRequests = 0;
                                t._promise = override(t._promise, function (orig_promise) {
                                    return function (mode, fn, writeLock) {
                                        ++uncompletedRequests;
                                        function proxy(fn) {
                                            return function () {
                                                fn.apply(this, arguments);
                                                if (--uncompletedRequests === 0) cb(); // A called db operation has completed without starting a new operation. The flow is finished, now run next upgrader.
                                            }
                                        }
                                        return orig_promise.call(this, mode, function (resolve, reject, trans) {
                                            arguments[0] = proxy(resolve);
                                            arguments[1] = proxy(reject);
                                            fn.apply(this, arguments);
                                        }, writeLock);
                                    };
                                });
                                idbtrans.onerror = eventRejectHandler(reject, ["running upgrader function for version", version._cfg.version]);
                                t.on('error').subscribe(reject);
                                version._cfg.contentUpgrade(t);
                                if (uncompletedRequests === 0) cb(); // contentUpgrade() didnt call any db operations at all.
                            });
                        }
                        if (!anyContentUpgraderHasRun || !hasIEDeleteObjectStoreBug()) { // Dont delete old tables if ieBug is present and a content upgrader has run. Let tables be left in DB so far. This needs to be taken care of.
                            queue.push(function (idbtrans, cb) {
                                // Delete old tables
                                deleteRemovedTables(newSchema, idbtrans);
                                cb();
                            });
                        }
                    }
                });

                // Now, create a queue execution engine
                var runNextQueuedFunction = function () {
                    try {
                        if (queue.length)
                            queue.shift()(idbtrans, runNextQueuedFunction);
                        else
                            createMissingTables(globalSchema, idbtrans); // At last, make sure to create any missing tables. (Needed by addons that add stores to DB without specifying version)
                    } catch (err) {
                        openReq.onerror = idbtrans.onerror = function (ev) { ev.preventDefault(); };  // Prohibit AbortError fire on db.on("error") in Firefox.
                        try { idbtrans.abort(); } catch(e) {}
                        idbtrans.db.close();
                        reject(err);
                    }
                };
                runNextQueuedFunction();
            }
        }

        function getSchemaDiff(oldSchema, newSchema) {
            var diff = {
                del: [], // Array of table names
                add: [], // Array of [tableName, newDefinition]
                change: [] // Array of {name: tableName, recreate: newDefinition, del: delIndexNames, add: newIndexDefs, change: changedIndexDefs}
            };
            for (var table in oldSchema) {
                if (!newSchema[table]) diff.del.push(table);
            }
            for (var table in newSchema) {
                var oldDef = oldSchema[table],
                    newDef = newSchema[table];
                if (!oldDef) diff.add.push([table, newDef]);
                else {
                    var change = {
                        name: table,
                        def: newSchema[table],
                        recreate: false,
                        del: [],
                        add: [],
                        change: []
                    };
                    if (oldDef.primKey.src !== newDef.primKey.src) {
                        // Primary key has changed. Remove and re-add table.
                        change.recreate = true;
                        diff.change.push(change);
                    } else {
                        var oldIndexes = oldDef.indexes.reduce(function (prev, current) { prev[current.name] = current; return prev; }, {});
                        var newIndexes = newDef.indexes.reduce(function (prev, current) { prev[current.name] = current; return prev; }, {});
                        for (var idxName in oldIndexes) {
                            if (!newIndexes[idxName]) change.del.push(idxName);
                        }
                        for (var idxName in newIndexes) {
                            var oldIdx = oldIndexes[idxName],
                                newIdx = newIndexes[idxName];
                            if (!oldIdx) change.add.push(newIdx);
                            else if (oldIdx.src !== newIdx.src) change.change.push(newIdx);
                        }
                        if (change.recreate || change.del.length > 0 || change.add.length > 0 || change.change.length > 0) {
                            diff.change.push(change);
                        }
                    }
                }
            }
            return diff;
        }

        function createTable(idbtrans, tableName, primKey, indexes) {
            /// <param name="idbtrans" type="IDBTransaction"></param>
            var store = idbtrans.db.createObjectStore(tableName, primKey.keyPath ? { keyPath: primKey.keyPath, autoIncrement: primKey.auto } : { autoIncrement: primKey.auto });
            indexes.forEach(function (idx) { addIndex(store, idx); });
            return store;
        }

        function createMissingTables(newSchema, idbtrans) {
            Object.keys(newSchema).forEach(function (tableName) {
                if (!idbtrans.db.objectStoreNames.contains(tableName)) {
                    createTable(idbtrans, tableName, newSchema[tableName].primKey, newSchema[tableName].indexes);
                }
            });
        }

        function deleteRemovedTables(newSchema, idbtrans) {
            for (var i = 0; i < idbtrans.db.objectStoreNames.length; ++i) {
                var storeName = idbtrans.db.objectStoreNames[i];
                if (newSchema[storeName] === null || newSchema[storeName] === undefined) {
                    idbtrans.db.deleteObjectStore(storeName);
                }
            }
        }

        function addIndex(store, idx) {
            store.createIndex(idx.name, idx.keyPath, { unique: idx.unique, multiEntry: idx.multi });
        }

        //
        //
        //      Dexie Protected API
        //
        //

        this._allTables = allTables;

        this._tableFactory = function createTable(mode, tableSchema, transactionPromiseFactory) {
            /// <param name="tableSchema" type="TableSchema"></param>
            if (mode === READONLY)
                return new Table(tableSchema.name, transactionPromiseFactory, tableSchema, Collection);
            else
                return new WriteableTable(tableSchema.name, transactionPromiseFactory, tableSchema);
        }; 

        this._createTransaction = function (mode, storeNames, dbschema, parentTransaction) {
            return new Transaction(mode, storeNames, dbschema, parentTransaction);
        }; 

        function tableNotInTransaction(mode, storeNames) {
            throw new Error("Table " + storeNames[0] + " not part of transaction. Original Scope Function Source: " + Dexie.Promise.PSD.trans.scopeFunc.toString());
        }

        this._transPromiseFactory = function transactionPromiseFactory(mode, storeNames, fn) { // Last argument is "writeLocked". But this doesnt apply to oneshot direct db operations, so we ignore it.
            if (db_is_blocked && (!Promise.PSD || !Promise.PSD.letThrough)) {
                // Database is paused. Wait til resumed.
                var blockedPromise = new Promise(function (resolve, reject) {
                    pausedResumeables.push({
                        resume: function () {
                            var p = db._transPromiseFactory(mode, storeNames, fn);
                            blockedPromise.onuncatched = p.onuncatched;
                            p.then(resolve, reject);
                        }
                    });
                });
                return blockedPromise;
            } else {
                var trans = db._createTransaction(mode, storeNames, globalSchema);
                return trans._promise(mode, function (resolve, reject) {
                    // An uncatched operation will bubble to this anonymous transaction. Make sure
                    // to continue bubbling it up to db.on('error'):
                    trans.error(function (err) {
                        db.on('error').fire(err);
                    });
                    fn(function (value) {
                        // Instead of resolving value directly, wait with resolving it until transaction has completed.
                        // Otherwise the data would not be in the DB if requesting it in the then() operation.
                        // Specifically, to ensure that the following expression will work:
                        //
                        //   db.friends.put({name: "Arne"}).then(function () {
                        //       db.friends.where("name").equals("Arne").count(function(count) {
                        //           assert (count === 1);
                        //       });
                        //   });
                        //
                        trans.complete(function () {
                            resolve(value);
                        });
                    }, reject, trans);
                });
            }
        }; 

        this._whenReady = function (fn) {
            if (!fake && db_is_blocked && (!Promise.PSD || !Promise.PSD.letThrough)) {
                return new Promise(function (resolve, reject) {
                    pausedResumeables.push({
                        resume: function () {
                            fn(resolve, reject);
                        }
                    });
                });
            }
            return new Promise(fn);
        }; 

        //
        //
        //
        //
        //      Dexie API
        //
        //
        //

        this.verno = 0;

        this.open = function () {
            return new Promise(function (resolve, reject) {
                if (fake) resolve(db);
                if (idbdb || isBeingOpened) throw new Error("Database already opened or being opened");
                var req, dbWasCreated = false;
                function openError(err) {
                    try { req.transaction.abort(); } catch (e) { }
                    /*if (dbWasCreated) {
                        // Workaround for issue with some browsers. Seem not to be needed though.
                        // Unit test "Issue#100 - not all indexes are created" works without it on chrome,FF,opera and IE.
                        idbdb.close();
                        indexedDB.deleteDatabase(db.name); 
                    }*/
                    isBeingOpened = false;
                    dbOpenError = err;
                    db_is_blocked = false;
                    reject(dbOpenError);
                    pausedResumeables.forEach(function (resumable) {
                        // Resume all stalled operations. They will fail once they wake up.
                        resumable.resume();
                    });
                    pausedResumeables = [];
                }
                try {
                    dbOpenError = null;
                    isBeingOpened = true;

                    // Make sure caller has specified at least one version
                    if (versions.length > 0) autoSchema = false;

                    // Multiply db.verno with 10 will be needed to workaround upgrading bug in IE: 
                    // IE fails when deleting objectStore after reading from it.
                    // A future version of Dexie.js will stopover an intermediate version to workaround this.
                    // At that point, we want to be backward compatible. Could have been multiplied with 2, but by using 10, it is easier to map the number to the real version number.
                    if (!indexedDB) throw new Error("indexedDB API not found. If using IE10+, make sure to run your code on a server URL (not locally). If using Safari, make sure to include indexedDB polyfill.");
                    req = autoSchema ? indexedDB.open(dbName) : indexedDB.open(dbName, Math.round(db.verno * 10));
                    if (!req) throw new Error("IndexedDB API not available"); // May happen in Safari private mode, see https://github.com/dfahlander/Dexie.js/issues/134 
                    req.onerror = eventRejectHandler(openError, ["opening database", dbName]);
                    req.onblocked = function (ev) {
                        db.on("blocked").fire(ev);
                    }; 
                    req.onupgradeneeded = trycatch (function (e) {
                        if (autoSchema && !db._allowEmptyDB) { // Unless an addon has specified db._allowEmptyDB, lets make the call fail.
                            // Caller did not specify a version or schema. Doing that is only acceptable for opening alread existing databases.
                            // If onupgradeneeded is called it means database did not exist. Reject the open() promise and make sure that we 
                            // do not create a new database by accident here.
                            req.onerror = function (event) { event.preventDefault(); }; // Prohibit onabort error from firing before we're done!
                            req.transaction.abort(); // Abort transaction (would hope that this would make DB disappear but it doesnt.)
                            // Close database and delete it.
                            req.result.close();
                            var delreq = indexedDB.deleteDatabase(dbName); // The upgrade transaction is atomic, and javascript is single threaded - meaning that there is no risk that we delete someone elses database here!
                            delreq.onsuccess = delreq.onerror = function () {
                                openError(new Error("Database '" + dbName + "' doesnt exist"));
                            }; 
                        } else {
                            if (e.oldVersion === 0) dbWasCreated = true;
                            req.transaction.onerror = eventRejectHandler(openError);
                            var oldVer = e.oldVersion > Math.pow(2, 62) ? 0 : e.oldVersion; // Safari 8 fix.
                            runUpgraders(oldVer / 10, req.transaction, openError, req);
                        }
                    }, openError);
                    req.onsuccess = trycatch(function (e) {
                        isBeingOpened = false;
                        idbdb = req.result;
                        if (autoSchema) readGlobalSchema();
                        else if (idbdb.objectStoreNames.length > 0)
                            adjustToExistingIndexNames(globalSchema, idbdb.transaction(safariMultiStoreFix(idbdb.objectStoreNames), READONLY));
                        idbdb.onversionchange = db.on("versionchange").fire; // Not firing it here, just setting the function callback to any registered subscriber.
                        if (!hasNativeGetDatabaseNames) {
                            // Update localStorage with list of database names
                            globalDatabaseList(function (databaseNames) {
                                if (databaseNames.indexOf(dbName) === -1) return databaseNames.push(dbName);
                            });
                        }
                        // Now, let any subscribers to the on("ready") fire BEFORE any other db operations resume!
                        // If an the on("ready") subscriber returns a Promise, we will wait til promise completes or rejects before 
                        Promise.newPSD(function () {
                            Promise.PSD.letThrough = true; // Set a Promise-Specific Data property informing that onready is firing. This will make db._whenReady() let the subscribers use the DB but block all others (!). Quite cool ha?
                            try {
                                var res = db.on.ready.fire();
                                if (res && typeof res.then === 'function') {
                                    // If on('ready') returns a promise, wait for it to complete and then resume any pending operations.
                                    res.then(resume, function (err) {
                                        idbdb.close();
                                        idbdb = null;
                                        openError(err);
                                    });
                                } else {
                                    asap(resume); // Cannot call resume directly because then the pauseResumables would inherit from our PSD scope.
                                }
                            } catch (e) {
                                openError(e);
                            }

                            function resume() {
                                db_is_blocked = false;
                                pausedResumeables.forEach(function (resumable) {
                                    // If anyone has made operations on a table instance before the db was opened, the operations will start executing now.
                                    resumable.resume();
                                });
                                pausedResumeables = [];
                                resolve(db);
                            }
                        });
                    }, openError);
                } catch (err) {
                    openError(err);
                }
            });
        }; 

        this.close = function () {
            if (idbdb) {
                idbdb.close();
                idbdb = null;
                db_is_blocked = true;
                dbOpenError = null;
            }
        }; 

        this.delete = function () {
            var args = arguments;
            return new Promise(function (resolve, reject) {
                if (args.length > 0) throw new Error("Arguments not allowed in db.delete()");
                function doDelete() {
                    db.close();
                    var req = indexedDB.deleteDatabase(dbName);
                    req.onsuccess = function () {
                        if (!hasNativeGetDatabaseNames) {
                            globalDatabaseList(function(databaseNames) {
                                var pos = databaseNames.indexOf(dbName);
                                if (pos >= 0) return databaseNames.splice(pos, 1);
                            });
                        }
                        resolve();
                    };
                    req.onerror = eventRejectHandler(reject, ["deleting", dbName]);
                    req.onblocked = function() {
                        db.on("blocked").fire();
                    };
                }
                if (isBeingOpened) {
                    pausedResumeables.push({ resume: doDelete });
                } else {
                    doDelete();
                }
            });
        }; 

        this.backendDB = function () {
            return idbdb;
        }; 

        this.isOpen = function () {
            return idbdb !== null;
        }; 
        this.hasFailed = function () {
            return dbOpenError !== null;
        };
        this.dynamicallyOpened = function() {
            return autoSchema;
        }

        /*this.dbg = function (collection, counter) {
            if (!this._dbgResult || !this._dbgResult[counter]) {
                if (typeof collection === 'string') collection = this.table(collection).toCollection().limit(100);
                if (!this._dbgResult) this._dbgResult = [];
                var db = this;
                new Promise(function () {
                    Promise.PSD.letThrough = true;
                    db._dbgResult[counter] = collection.toArray();
                });
            }
            return this._dbgResult[counter]._value;
        }*/

        //
        // Properties
        //
        this.name = dbName;

        // db.tables - an array of all Table instances.
        // TODO: Change so that tables is a simple member and make sure to update it whenever allTables changes.
        Object.defineProperty(this, "tables", {
            get: function () {
                /// <returns type="Array" elementType="WriteableTable" />
                return Object.keys(allTables).map(function (name) { return allTables[name]; });
            }
        });

        //
        // Events
        //
        this.on = events(this, "error", "populate", "blocked", { "ready": [promisableChain, nop], "versionchange": [reverseStoppableEventChain, nop] });

        // Handle on('ready') specifically: If DB is already open, trigger the event immediately. Also, default to unsubscribe immediately after being triggered.
        this.on.ready.subscribe = override(this.on.ready.subscribe, function (origSubscribe) {
            return function (subscriber, bSticky) {
                function proxy () {
                    if (!bSticky) db.on.ready.unsubscribe(proxy);
                    return subscriber.apply(this, arguments);
                }
                origSubscribe.call(this, proxy);
                if (db.isOpen()) {
                    if (db_is_blocked) {
                        pausedResumeables.push({ resume: proxy });
                    } else {
                        proxy();
                    }
                }
            };
        });

        fakeAutoComplete(function () {
            db.on("populate").fire(db._createTransaction(READWRITE, dbStoreNames, globalSchema));
            db.on("error").fire(new Error());
        });

        this.transaction = function (mode, tableInstances, scopeFunc) {
            /// <summary>
            /// 
            /// </summary>
            /// <param name="mode" type="String">"r" for readonly, or "rw" for readwrite</param>
            /// <param name="tableInstances">Table instance, Array of Table instances, String or String Array of object stores to include in the transaction</param>
            /// <param name="scopeFunc" type="Function">Function to execute with transaction</param>

            // Let table arguments be all arguments between mode and last argument.
            tableInstances = [].slice.call(arguments, 1, arguments.length - 1);
            // Let scopeFunc be the last argument
            scopeFunc = arguments[arguments.length - 1];
            var parentTransaction = Promise.PSD && Promise.PSD.trans;
			// Check if parent transactions is bound to this db instance, and if caller wants to reuse it
            if (!parentTransaction || parentTransaction.db !== db || mode.indexOf('!') !== -1) parentTransaction = null;
            var onlyIfCompatible = mode.indexOf('?') !== -1;
            mode = mode.replace('!', '').replace('?', '');
            //
            // Get storeNames from arguments. Either through given table instances, or through given table names.
            //
            var tables = Array.isArray(tableInstances[0]) ? tableInstances.reduce(function (a, b) { return a.concat(b); }) : tableInstances;
            var error = null;
            var storeNames = tables.map(function (tableInstance) {
                if (typeof tableInstance === "string") {
                    return tableInstance;
                } else {
                    if (!(tableInstance instanceof Table)) error = error || new TypeError("Invalid type. Arguments following mode must be instances of Table or String");
                    return tableInstance.name;
                }
            });

            //
            // Resolve mode. Allow shortcuts "r" and "rw".
            //
            if (mode == "r" || mode == READONLY)
                mode = READONLY;
            else if (mode == "rw" || mode == READWRITE)
                mode = READWRITE;
            else
                error = new Error("Invalid transaction mode: " + mode);

            if (parentTransaction) {
                // Basic checks
                if (!error) {
                    if (parentTransaction && parentTransaction.mode === READONLY && mode === READWRITE) {
                        if (onlyIfCompatible) parentTransaction = null; // Spawn new transaction instead.
                        else error = error || new Error("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
                    }
                    if (parentTransaction) {
                        storeNames.forEach(function (storeName) {
                            if (!parentTransaction.tables.hasOwnProperty(storeName)) {
                                if (onlyIfCompatible) parentTransaction = null; // Spawn new transaction instead.
                                else error = error || new Error("Table " + storeName + " not included in parent transaction. Parent Transaction function: " + parentTransaction.scopeFunc.toString());
                            }
                        });
                    }
                }
            }
            if (parentTransaction) {
                // If this is a sub-transaction, lock the parent and then launch the sub-transaction.
                return parentTransaction._promise(mode, enterTransactionScope, "lock");
            } else {
                // If this is a root-level transaction, wait til database is ready and then launch the transaction.
                return db._whenReady(enterTransactionScope);
            }
            
            function enterTransactionScope(resolve, reject) {
                // Our transaction. To be set later.
                var trans = null;

                try {
                    // Throw any error if any of the above checks failed.
                    // Real error defined some lines up. We throw it here from within a Promise to reject Promise
                    // rather than make caller need to both use try..catch and promise catching. The reason we still
                    // throw here rather than do Promise.reject(error) is that we like to have the stack attached to the
                    // error. Also because there is a catch() clause bound to this try() that will bubble the error
                    // to the parent transaction.
                    if (error) throw error;

                    //
                    // Create Transaction instance
                    //
                    trans = db._createTransaction(mode, storeNames, globalSchema, parentTransaction);

                    // Provide arguments to the scope function (for backward compatibility)
                    var tableArgs = storeNames.map(function (name) { return trans.tables[name]; });
                    tableArgs.push(trans);

                    // If transaction completes, resolve the Promise with the return value of scopeFunc.
                    var returnValue;
                    var uncompletedRequests = 0;

                    // Create a new PSD frame to hold Promise.PSD.trans. Must not be bound to the current PSD frame since we want
                    // it to pop before then() callback is called of our returned Promise.
                    Promise.newPSD(function () {
                        // Let the transaction instance be part of a Promise-specific data (PSD) value.
                        Promise.PSD.trans = trans;
                        trans.scopeFunc = scopeFunc; // For Error ("Table " + storeNames[0] + " not part of transaction") when it happens. This may help localizing the code that started a transaction used on another place.

                        if (parentTransaction) {
                            // Emulate transaction commit awareness for inner transaction (must 'commit' when the inner transaction has no more operations ongoing)
                            trans.idbtrans = parentTransaction.idbtrans;
                            trans._promise = override(trans._promise, function (orig) {
                                return function (mode, fn, writeLock) {
                                    ++uncompletedRequests;
                                    function proxy(fn2) {
                                        return function (val) {
                                            var retval;
                                            // _rootExec needed so that we do not loose any IDBTransaction in a setTimeout() call.
                                            Promise._rootExec(function () {
                                                retval = fn2(val);
                                                // _tickFinalize makes sure to support lazy micro tasks executed in Promise._rootExec().
                                                // We certainly do not want to copy the bad pattern from IndexedDB but instead allow
                                                // execution of Promise.then() callbacks until the're all done.
                                                Promise._tickFinalize(function () {
                                                    if (--uncompletedRequests === 0 && trans.active) {
                                                        trans.active = false;
                                                        trans.on.complete.fire(); // A called db operation has completed without starting a new operation. The flow is finished
                                                    }
                                                });
                                            });
                                            return retval;
                                        }
                                    }
                                    return orig.call(this, mode, function (resolve2, reject2, trans) {
                                        return fn(proxy(resolve2), proxy(reject2), trans);
                                    }, writeLock);
                                };
                            });
                        }
                        trans.complete(function () {
                            resolve(returnValue);
                        });
                        // If transaction fails, reject the Promise and bubble to db if noone catched this rejection.
                        trans.error(function (e) {
                            if (trans.idbtrans) trans.idbtrans.onerror = preventDefault; // Prohibit AbortError from firing.
                            try {trans.abort();} catch(e2){}
                            if (parentTransaction) {
                                parentTransaction.active = false;
                                parentTransaction.on.error.fire(e); // Bubble to parent transaction
                            }
                            var catched = reject(e);
                            if (!parentTransaction && !catched) {
                                db.on.error.fire(e);// If not catched, bubble error to db.on("error").
                            }
                        });

                        // Finally, call the scope function with our table and transaction arguments.
                        Promise._rootExec(function() {
                            returnValue = scopeFunc.apply(trans, tableArgs); // NOTE: returnValue is used in trans.on.complete() not as a returnValue to this func.
                        });
                    });
                    if (!trans.idbtrans || (parentTransaction && uncompletedRequests === 0)) {
                        trans._nop(); // Make sure transaction is being used so that it will resolve.
                    }
                } catch (e) {
                    // If exception occur, abort the transaction and reject Promise.
                    if (trans && trans.idbtrans) trans.idbtrans.onerror = preventDefault; // Prohibit AbortError from firing.
                    if (trans) trans.abort();
                    if (parentTransaction) parentTransaction.on.error.fire(e);
                    asap(function () {
                        // Need to use asap(=setImmediate/setTimeout) before calling reject because we are in the Promise constructor and reject() will always return false if so.
                        if (!reject(e)) db.on("error").fire(e); // If not catched, bubble exception to db.on("error");
                    });
                }
            }
        }; 

        this.table = function (tableName) {
            /// <returns type="WriteableTable"></returns>
            if (fake && autoSchema) return new WriteableTable(tableName);
            if (!allTables.hasOwnProperty(tableName)) { throw new Error("Table does not exist"); return { AN_UNKNOWN_TABLE_NAME_WAS_SPECIFIED: 1 }; }
            return allTables[tableName];
        };

        //
        //
        //
        // Table Class
        //
        //
        //
        function Table(name, transactionPromiseFactory, tableSchema, collClass) {
            /// <param name="name" type="String"></param>
            this.name = name;
            this.schema = tableSchema;
            this.hook = allTables[name] ? allTables[name].hook : events(null, {
                "creating": [hookCreatingChain, nop],
                "reading": [pureFunctionChain, mirror],
                "updating": [hookUpdatingChain, nop],
                "deleting": [nonStoppableEventChain, nop]
            });
            this._tpf = transactionPromiseFactory;
            this._collClass = collClass || Collection;
        }

        extend(Table.prototype, function () {
            function failReadonly() {
                throw new Error("Current Transaction is READONLY");
            }
            return {
                //
                // Table Protected Methods
                //

                _trans: function getTransaction(mode, fn, writeLocked) {
                    return this._tpf(mode, [this.name], fn, writeLocked);
                },
                _idbstore: function getIDBObjectStore(mode, fn, writeLocked) {
                    if (fake) return new Promise(fn); // Simplify the work for Intellisense/Code completion.
                    var self = this;
                    return this._tpf(mode, [this.name], function (resolve, reject, trans) {
                        fn(resolve, reject, trans.idbtrans.objectStore(self.name), trans);
                    }, writeLocked);
                },

                //
                // Table Public Methods
                //
                get: function (key, cb) {
                    var self = this;
                    return this._idbstore(READONLY, function (resolve, reject, idbstore) {
                        fake && resolve(self.schema.instanceTemplate);
                        var req = idbstore.get(key);
                        req.onerror = eventRejectHandler(reject, ["getting", key, "from", self.name]);
                        req.onsuccess = function () {
                            resolve(self.hook.reading.fire(req.result));
                        };
                    }).then(cb);
                },
                where: function (indexName) {
                    return new WhereClause(this, indexName);
                },
                count: function (cb) {
                    return this.toCollection().count(cb);
                },
                offset: function (offset) {
                    return this.toCollection().offset(offset);
                },
                limit: function (numRows) {
                    return this.toCollection().limit(numRows);
                },
                reverse: function () {
                    return this.toCollection().reverse();
                },
                filter: function (filterFunction) {
                    return this.toCollection().and(filterFunction);
                },
                each: function (fn) {
                    var self = this;
                    fake && fn(self.schema.instanceTemplate);
                    return this._idbstore(READONLY, function (resolve, reject, idbstore) {
                        var req = idbstore.openCursor();
                        req.onerror = eventRejectHandler(reject, ["calling", "Table.each()", "on", self.name]);
                        iterate(req, null, fn, resolve, reject, self.hook.reading.fire);
                    });
                },
                toArray: function (cb) {
                    var self = this;
                    return this._idbstore(READONLY, function (resolve, reject, idbstore) {
                        fake && resolve([self.schema.instanceTemplate]);
                        var a = [];
                        var req = idbstore.openCursor();
                        req.onerror = eventRejectHandler(reject, ["calling", "Table.toArray()", "on", self.name]);
                        iterate(req, null, function (item) { a.push(item); }, function () { resolve(a); }, reject, self.hook.reading.fire);
                    }).then(cb);
                },
                orderBy: function (index) {
                    return new this._collClass(new WhereClause(this, index));
                },

                toCollection: function () {
                    return new this._collClass(new WhereClause(this));
                },

                mapToClass: function (constructor, structure) {
                    /// <summary>
                    ///     Map table to a javascript constructor function. Objects returned from the database will be instances of this class, making
                    ///     it possible to the instanceOf operator as well as extending the class using constructor.prototype.method = function(){...}.
                    /// </summary>
                    /// <param name="constructor">Constructor function representing the class.</param>
                    /// <param name="structure" optional="true">Helps IDE code completion by knowing the members that objects contain and not just the indexes. Also
                    /// know what type each member has. Example: {name: String, emailAddresses: [String], password}</param>
                    this.schema.mappedClass = constructor;
                    var instanceTemplate = Object.create(constructor.prototype);
                    if (structure) {
                        // structure and instanceTemplate is for IDE code competion only while constructor.prototype is for actual inheritance.
                        applyStructure(instanceTemplate, structure);
                    }
                    this.schema.instanceTemplate = instanceTemplate;

                    // Now, subscribe to the when("reading") event to make all objects that come out from this table inherit from given class
                    // no matter which method to use for reading (Table.get() or Table.where(...)... )
                    var readHook = function (obj) {
                        if (!obj) return obj; // No valid object. (Value is null). Return as is.
                        // Create a new object that derives from constructor:
                        var res = Object.create(constructor.prototype);
                        // Clone members:
                        for (var m in obj) if (obj.hasOwnProperty(m)) res[m] = obj[m];
                        return res;
                    };

                    if (this.schema.readHook) {
                        this.hook.reading.unsubscribe(this.schema.readHook);
                    }
                    this.schema.readHook = readHook;
                    this.hook("reading", readHook);
                    return constructor;
                },
                defineClass: function (structure) {
                    /// <summary>
                    ///     Define all members of the class that represents the table. This will help code completion of when objects are read from the database
                    ///     as well as making it possible to extend the prototype of the returned constructor function.
                    /// </summary>
                    /// <param name="structure">Helps IDE code completion by knowing the members that objects contain and not just the indexes. Also
                    /// know what type each member has. Example: {name: String, emailAddresses: [String], properties: {shoeSize: Number}}</param>
                    return this.mapToClass(Dexie.defineClass(structure), structure);
                },
                add: failReadonly,
                put: failReadonly,
                'delete': failReadonly,
                clear: failReadonly,
                update: failReadonly
            };
        });

        //
        //
        //
        // WriteableTable Class (extends Table)
        //
        //
        //
        function WriteableTable(name, transactionPromiseFactory, tableSchema, collClass) {
            Table.call(this, name, transactionPromiseFactory, tableSchema, collClass || WriteableCollection);
        }

        derive(WriteableTable).from(Table).extend(function () {
            return {
                add: function (obj, key) {
                    /// <summary>
                    ///   Add an object to the database. In case an object with same primary key already exists, the object will not be added.
                    /// </summary>
                    /// <param name="obj" type="Object">A javascript object to insert</param>
                    /// <param name="key" optional="true">Primary key</param>
                    var self = this,
                        creatingHook = this.hook.creating.fire;
                    return this._idbstore(READWRITE, function (resolve, reject, idbstore, trans) {
                        var thisCtx = {};
                        if (creatingHook !== nop) {
                            var effectiveKey = key || (idbstore.keyPath ? getByKeyPath(obj, idbstore.keyPath) : undefined);
                            var keyToUse = creatingHook.call(thisCtx, effectiveKey, obj, trans); // Allow subscribers to when("creating") to generate the key.
                            if (effectiveKey === undefined && keyToUse !== undefined) {
                                if (idbstore.keyPath)
                                    setByKeyPath(obj, idbstore.keyPath, keyToUse);
                                else
                                    key = keyToUse;
                            }
                        }
                        //try {
                            var req = key ? idbstore.add(obj, key) : idbstore.add(obj);
                            req.onerror = eventRejectHandler(function (e) {
                                if (thisCtx.onerror) thisCtx.onerror(e);
                                return reject(e);
                            }, ["adding", obj, "into", self.name]);
                            req.onsuccess = function (ev) {
                                var keyPath = idbstore.keyPath;
                                if (keyPath) setByKeyPath(obj, keyPath, ev.target.result);
                                if (thisCtx.onsuccess) thisCtx.onsuccess(ev.target.result);
                                resolve(req.result);
                            };
                        /*} catch (e) {
                            trans.on("error").fire(e);
                            trans.abort();
                            reject(e);
                        }*/
                    });
                },

                put: function (obj, key) {
                    /// <summary>
                    ///   Add an object to the database but in case an object with same primary key alread exists, the existing one will get updated.
                    /// </summary>
                    /// <param name="obj" type="Object">A javascript object to insert or update</param>
                    /// <param name="key" optional="true">Primary key</param>
                    var self = this,
                        creatingHook = this.hook.creating.fire,
                        updatingHook = this.hook.updating.fire;
                    if (creatingHook !== nop || updatingHook !== nop) {
                        //
                        // People listens to when("creating") or when("updating") events!
                        // We must know whether the put operation results in an CREATE or UPDATE.
                        //
                        return this._trans(READWRITE, function (resolve, reject, trans) {
                            // Since key is optional, make sure we get it from obj if not provided
                            var effectiveKey = key || (self.schema.primKey.keyPath && getByKeyPath(obj, self.schema.primKey.keyPath));
                            if (effectiveKey === undefined) {
                                // No primary key. Must use add().
                                trans.tables[self.name].add(obj).then(resolve, reject);
                            } else {
                                // Primary key exist. Lock transaction and try modifying existing. If nothing modified, call add().
                                trans._lock(); // Needed because operation is splitted into modify() and add().
                                // clone obj before this async call. If caller modifies obj the line after put(), the IDB spec requires that it should not affect operation.
                                obj = deepClone(obj);
                                trans.tables[self.name].where(":id").equals(effectiveKey).modify(function (value) {
                                    // Replace extisting value with our object
                                    // CRUD event firing handled in WriteableCollection.modify()
                                    this.value = obj;
                                }).then(function (count) {
                                    if (count === 0) {
                                        // Object's key was not found. Add the object instead.
                                        // CRUD event firing will be done in add()
                                        return trans.tables[self.name].add(obj, key); // Resolving with another Promise. Returned Promise will then resolve with the new key.
                                    } else {
                                        return effectiveKey; // Resolve with the provided key.
                                    }
                                }).finally(function () {
                                    trans._unlock();
                                }).then(resolve, reject);
                            }
                        });
                    } else {
                        // Use the standard IDB put() method.
                        return this._idbstore(READWRITE, function (resolve, reject, idbstore) {
                            var req = key ? idbstore.put(obj, key) : idbstore.put(obj);
                            req.onerror = eventRejectHandler(reject, ["putting", obj, "into", self.name]);
                            req.onsuccess = function (ev) {
                                var keyPath = idbstore.keyPath;
                                if (keyPath) setByKeyPath(obj, keyPath, ev.target.result);
                                resolve(req.result);
                            };
                        });
                    }
                },

                'delete': function (key) {
                    /// <param name="key">Primary key of the object to delete</param>
                    if (this.hook.deleting.subscribers.length) {
                        // People listens to when("deleting") event. Must implement delete using WriteableCollection.delete() that will
                        // call the CRUD event. Only WriteableCollection.delete() will know whether an object was actually deleted.
                        return this.where(":id").equals(key).delete();
                    } else {
                        // No one listens. Use standard IDB delete() method.
                        return this._idbstore(READWRITE, function (resolve, reject, idbstore) {
                            var req = idbstore.delete(key);
                            req.onerror = eventRejectHandler(reject, ["deleting", key, "from", idbstore.name]);
                            req.onsuccess = function (ev) {
                                resolve(req.result);
                            };
                        });
                    }
                },

                clear: function () {
                    if (this.hook.deleting.subscribers.length) {
                        // People listens to when("deleting") event. Must implement delete using WriteableCollection.delete() that will
                        // call the CRUD event. Only WriteableCollection.delete() will knows which objects that are actually deleted.
                        return this.toCollection().delete();
                    } else {
                        return this._idbstore(READWRITE, function (resolve, reject, idbstore) {
                            var req = idbstore.clear();
                            req.onerror = eventRejectHandler(reject, ["clearing", idbstore.name]);
                            req.onsuccess = function (ev) {
                                resolve(req.result);
                            };
                        });
                    }
                },

                update: function (keyOrObject, modifications) {
                    if (typeof modifications !== 'object' || Array.isArray(modifications)) throw new Error("db.update(keyOrObject, modifications). modifications must be an object.");
                    if (typeof keyOrObject === 'object' && !Array.isArray(keyOrObject)) {
                        // object to modify. Also modify given object with the modifications:
                        Object.keys(modifications).forEach(function (keyPath) {
                            setByKeyPath(keyOrObject, keyPath, modifications[keyPath]);
                        });
                        var key = getByKeyPath(keyOrObject, this.schema.primKey.keyPath);
                        if (key === undefined) Promise.reject(new Error("Object does not contain its primary key"));
                        return this.where(":id").equals(key).modify(modifications);
                    } else {
                        // key to modify
                        return this.where(":id").equals(keyOrObject).modify(modifications);
                    }
                },
            };
        });

        //
        //
        //
        // Transaction Class
        //
        //
        //
        function Transaction(mode, storeNames, dbschema, parent) {
            /// <summary>
            ///    Transaction class. Represents a database transaction. All operations on db goes through a Transaction.
            /// </summary>
            /// <param name="mode" type="String">Any of "readwrite" or "readonly"</param>
            /// <param name="storeNames" type="Array">Array of table names to operate on</param>
            var self = this;
            this.db = db;
            this.mode = mode;
            this.storeNames = storeNames;
            this.idbtrans = null;
            this.on = events(this, ["complete", "error"], "abort");
            this._reculock = 0;
            this._blockedFuncs = [];
            this._psd = null;
            this.active = true;
            this._dbschema = dbschema;
            if (parent) this.parent = parent;
            this._tpf = transactionPromiseFactory;
            this.tables = Object.create(notInTransFallbackTables); // ...so that all non-included tables exists as instances (possible to call table.name for example) but will fail as soon as trying to execute a query on it.

            function transactionPromiseFactory(mode, storeNames, fn, writeLocked) {
                // Creates a Promise instance and calls fn (resolve, reject, trans) where trans is the instance of this transaction object.
                // Support for write-locking the transaction during the promise life time from creation to success/failure.
                // This is actually not needed when just using single operations on IDB, since IDB implements this internally.
                // However, when implementing a write operation as a series of operations on top of IDB(collection.delete() and collection.modify() for example),
                // lock is indeed needed if Dexie APIshould behave in a consistent manner for the API user.
                // Another example of this is if we want to support create/update/delete events,
                // we need to implement put() using a series of other IDB operations but still need to lock the transaction all the way.
                return self._promise(mode, fn, writeLocked);
            }

            for (var i = storeNames.length - 1; i !== -1; --i) {
                var name = storeNames[i];
                var table = db._tableFactory(mode, dbschema[name], transactionPromiseFactory);
                this.tables[name] = table;
                if (!this[name]) this[name] = table;
            }
        }

        extend(Transaction.prototype, {
            //
            // Transaction Protected Methods (not required by API users, but needed internally and eventually by dexie extensions)
            //

            _lock: function () {
                // Temporary set all requests into a pending queue if they are called before database is ready.
                ++this._reculock; // Recursive read/write lock pattern using PSD (Promise Specific Data) instead of TLS (Thread Local Storage)
                if (this._reculock === 1 && Promise.PSD) Promise.PSD.lockOwnerFor = this;
                return this;
            },
            _unlock: function () {
                if (--this._reculock === 0) {
                    if (Promise.PSD) Promise.PSD.lockOwnerFor = null;
                    while (this._blockedFuncs.length > 0 && !this._locked()) {
                        var fn = this._blockedFuncs.shift();
                        try { fn(); } catch (e) { }
                    }
                }
                return this;
            },
            _locked: function () {
                // Checks if any write-lock is applied on this transaction.
                // To simplify the Dexie API for extension implementations, we support recursive locks.
                // This is accomplished by using "Promise Specific Data" (PSD).
                // PSD data is bound to a Promise and any child Promise emitted through then() or resolve( new Promise() ).
                // Promise.PSD is local to code executing on top of the call stacks of any of any code executed by Promise():
                //         * callback given to the Promise() constructor  (function (resolve, reject){...})
                //         * callbacks given to then()/catch()/finally() methods (function (value){...})
                // If creating a new independant Promise instance from within a Promise call stack, the new Promise will derive the PSD from the call stack of the parent Promise.
                // Derivation is done so that the inner PSD __proto__ points to the outer PSD.
                // Promise.PSD.lockOwnerFor will point to current transaction object if the currently executing PSD scope owns the lock.
                return this._reculock && (!Promise.PSD || Promise.PSD.lockOwnerFor !== this);
            },
            _nop: function (cb) {
                // An asyncronic no-operation that may call given callback when done doing nothing. An alternative to asap() if we must not lose the transaction.
                this.tables[this.storeNames[0]].get(0).then(cb);
            },
            _promise: function (mode, fn, bWriteLock) {
                var self = this;
                return Promise.newPSD(function() {
                    var p;
                    // Read lock always
                    if (!self._locked()) {
                        p = self.active ? new Promise(function (resolve, reject) {
                            if (!self.idbtrans && mode) {
                                if (!idbdb) throw dbOpenError ? new Error("Database not open. Following error in populate, ready or upgrade function made Dexie.open() fail: " + dbOpenError) : new Error("Database not open");
                                var idbtrans = self.idbtrans = idbdb.transaction(safariMultiStoreFix(self.storeNames), self.mode);
                                idbtrans.onerror = function (e) {
                                    self.on("error").fire(e && e.target.error);
                                    e.preventDefault(); // Prohibit default bubbling to window.error
                                    self.abort(); // Make sure transaction is aborted since we preventDefault.
                                }; 
                                idbtrans.onabort = function (e) {
                                    // Workaround for issue #78 - low disk space on chrome.
                                    // onabort is called but never onerror. Call onerror explicitely.
                                    // Do this in a future tick so we allow default onerror to execute before doing the fallback.
                                    asap(function () { self.on('error').fire(new Error("Transaction aborted for unknown reason")); });

                                    self.active = false;
                                    self.on("abort").fire(e);
                                };
                                idbtrans.oncomplete = function (e) {
                                    self.active = false;
                                    self.on("complete").fire(e);
                                }; 
                            }
                            if (bWriteLock) self._lock(); // Write lock if write operation is requested
                            try {
                                fn(resolve, reject, self);
                            } catch (e) {
                                // Direct exception happened when doin operation.
                                // We must immediately fire the error and abort the transaction.
                                // When this happens we are still constructing the Promise so we don't yet know
                                // whether the caller is about to catch() the error or not. Have to make
                                // transaction fail. Catching such an error wont stop transaction from failing.
                                // This is a limitation we have to live with.
                                Dexie.ignoreTransaction(function () { self.on('error').fire(e); });
                                self.abort();
                                reject(e);
                            }
                        }) : Promise.reject(stack(new Error("Transaction is inactive. Original Scope Function Source: " + self.scopeFunc.toString())));
                        if (self.active && bWriteLock) p.finally(function () {
                            self._unlock();
                        });
                    } else {
                        // Transaction is write-locked. Wait for mutex.
                        p = new Promise(function (resolve, reject) {
                            self._blockedFuncs.push(function () {
                                self._promise(mode, fn, bWriteLock).then(resolve, reject);
                            });
                        });
                    }
                    p.onuncatched = function (e) {
                        // Bubble to transaction. Even though IDB does this internally, it would just do it for error events and not for caught exceptions.
                        Dexie.ignoreTransaction(function () { self.on("error").fire(e); });
                        self.abort();
                    };
                    return p;
                });
            },

            //
            // Transaction Public Methods
            //

            complete: function (cb) {
                return this.on("complete", cb);
            },
            error: function (cb) {
                return this.on("error", cb);
            },
            abort: function () {
                if (this.idbtrans && this.active) try { // TODO: if !this.idbtrans, enqueue an abort() operation.
                    this.active = false;
                    this.idbtrans.abort();
                    this.on.error.fire(new Error("Transaction Aborted"));
                } catch (e) { }
            },
            table: function (name) {
                if (!this.tables.hasOwnProperty(name)) { throw new Error("Table " + name + " not in transaction"); return { AN_UNKNOWN_TABLE_NAME_WAS_SPECIFIED: 1 }; }
                return this.tables[name];
            }
        });

        //
        //
        //
        // WhereClause
        //
        //
        //
        function WhereClause(table, index, orCollection) {
            /// <param name="table" type="Table"></param>
            /// <param name="index" type="String" optional="true"></param>
            /// <param name="orCollection" type="Collection" optional="true"></param>
            this._ctx = {
                table: table,
                index: index === ":id" ? null : index,
                collClass: table._collClass,
                or: orCollection
            }; 
        }

        extend(WhereClause.prototype, function () {

            // WhereClause private methods

            function fail(collection, err) {
                try { throw err; } catch (e) {
                    collection._ctx.error = e;
                }
                return collection;
            }

            function getSetArgs(args) {
                return Array.prototype.slice.call(args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
            }

            function upperFactory(dir) {
                return dir === "next" ? function (s) { return s.toUpperCase(); } : function (s) { return s.toLowerCase(); };
            }
            function lowerFactory(dir) {
                return dir === "next" ? function (s) { return s.toLowerCase(); } : function (s) { return s.toUpperCase(); };
            }
            function nextCasing(key, lowerKey, upperNeedle, lowerNeedle, cmp, dir) {
                var length = Math.min(key.length, lowerNeedle.length);
                var llp = -1;
                for (var i = 0; i < length; ++i) {
                    var lwrKeyChar = lowerKey[i];
                    if (lwrKeyChar !== lowerNeedle[i]) {
                        if (cmp(key[i], upperNeedle[i]) < 0) return key.substr(0, i) + upperNeedle[i] + upperNeedle.substr(i + 1);
                        if (cmp(key[i], lowerNeedle[i]) < 0) return key.substr(0, i) + lowerNeedle[i] + upperNeedle.substr(i + 1);
                        if (llp >= 0) return key.substr(0, llp) + lowerKey[llp] + upperNeedle.substr(llp + 1);
                        return null;
                    }
                    if (cmp(key[i], lwrKeyChar) < 0) llp = i;
                }
                if (length < lowerNeedle.length && dir === "next") return key + upperNeedle.substr(key.length);
                if (length < key.length && dir === "prev") return key.substr(0, upperNeedle.length);
                return (llp < 0 ? null : key.substr(0, llp) + lowerNeedle[llp] + upperNeedle.substr(llp + 1));
            }

            function addIgnoreCaseAlgorithm(c, match, needle) {
                /// <param name="needle" type="String"></param>
                var upper, lower, compare, upperNeedle, lowerNeedle, direction;
                function initDirection(dir) {
                    upper = upperFactory(dir);
                    lower = lowerFactory(dir);
                    compare = (dir === "next" ? ascending : descending);
                    upperNeedle = upper(needle);
                    lowerNeedle = lower(needle);
                    direction = dir;
                }
                initDirection("next");
                c._ondirectionchange = function (direction) {
                    // This event onlys occur before filter is called the first time.
                    initDirection(direction);
                };
                c._addAlgorithm(function (cursor, advance, resolve) {
                    /// <param name="cursor" type="IDBCursor"></param>
                    /// <param name="advance" type="Function"></param>
                    /// <param name="resolve" type="Function"></param>
                    var key = cursor.key;
                    if (typeof key !== 'string') return false;
                    var lowerKey = lower(key);
                    if (match(lowerKey, lowerNeedle)) {
                        advance(function () { cursor.continue(); });
                        return true;
                    } else {
                        var nextNeedle = nextCasing(key, lowerKey, upperNeedle, lowerNeedle, compare, direction);
                        if (nextNeedle) {
                            advance(function () { cursor.continue(nextNeedle); });
                        } else {
                            advance(resolve);
                        }
                        return false;
                    }
                });
            }

            //
            // WhereClause public methods
            //
            return {
                between: function (lower, upper, includeLower, includeUpper) {
                    /// <summary>
                    ///     Filter out records whose where-field lays between given lower and upper values. Applies to Strings, Numbers and Dates.
                    /// </summary>
                    /// <param name="lower"></param>
                    /// <param name="upper"></param>
                    /// <param name="includeLower" optional="true">Whether items that equals lower should be included. Default true.</param>
                    /// <param name="includeUpper" optional="true">Whether items that equals upper should be included. Default false.</param>
                    /// <returns type="Collection"></returns>
                    includeLower = includeLower !== false;   // Default to true
                    includeUpper = includeUpper === true;    // Default to false
                    if ((lower > upper) ||
                        (lower === upper && (includeLower || includeUpper) && !(includeLower && includeUpper)))
                        return new this._ctx.collClass(this, function() { return IDBKeyRange.only(lower); }).limit(0); // Workaround for idiotic W3C Specification that DataError must be thrown if lower > upper. The natural result would be to return an empty collection.
                    return new this._ctx.collClass(this, function() { return IDBKeyRange.bound(lower, upper, !includeLower, !includeUpper); });
                },
                equals: function (value) {
                    return new this._ctx.collClass(this, function() { return IDBKeyRange.only(value); });
                },
                above: function (value) {
                    return new this._ctx.collClass(this, function() { return IDBKeyRange.lowerBound(value, true); });
                },
                aboveOrEqual: function (value) {
                    return new this._ctx.collClass(this, function() { return IDBKeyRange.lowerBound(value); });
                },
                below: function (value) {
                    return new this._ctx.collClass(this, function() { return IDBKeyRange.upperBound(value, true); });
                },
                belowOrEqual: function (value) {
                    return new this._ctx.collClass(this, function() { return IDBKeyRange.upperBound(value); });
                },
                startsWith: function (str) {
                    /// <param name="str" type="String"></param>
                    if (typeof str !== 'string') return fail(new this._ctx.collClass(this), new TypeError("String expected"));
                    return this.between(str, str + String.fromCharCode(65535), true, true);
                },
                startsWithIgnoreCase: function (str) {
                    /// <param name="str" type="String"></param>
                    if (typeof str !== 'string') return fail(new this._ctx.collClass(this), new TypeError("String expected"));
                    if (str === "") return this.startsWith(str);
                    var c = new this._ctx.collClass(this, function() { return IDBKeyRange.bound(str.toUpperCase(), str.toLowerCase() + String.fromCharCode(65535)); });
                    addIgnoreCaseAlgorithm(c, function (a, b) { return a.indexOf(b) === 0; }, str);
                    c._ondirectionchange = function () { fail(c, new Error("reverse() not supported with WhereClause.startsWithIgnoreCase()")); };
                    return c;
                },
                equalsIgnoreCase: function (str) {
                    /// <param name="str" type="String"></param>
                    if (typeof str !== 'string') return fail(new this._ctx.collClass(this), new TypeError("String expected"));
                    var c = new this._ctx.collClass(this, function() { return IDBKeyRange.bound(str.toUpperCase(), str.toLowerCase()); });
                    addIgnoreCaseAlgorithm(c, function (a, b) { return a === b; }, str);
                    return c;
                },
                anyOf: function (valueArray) {
                    var ctx = this._ctx,
                        schema = ctx.table.schema;
                    var idxSpec = ctx.index ? schema.idxByName[ctx.index] : schema.primKey;
                    var isCompound = idxSpec && idxSpec.compound;
                    var set = getSetArgs(arguments);
                    var compare = isCompound ? compoundCompare(ascending) : ascending;
                    set.sort(compare);
                    if (set.length === 0) return new this._ctx.collClass(this, function() { return IDBKeyRange.only(""); }).limit(0); // Return an empty collection.
                    var c = new this._ctx.collClass(this, function () { return IDBKeyRange.bound(set[0], set[set.length - 1]); });
                    
                    c._ondirectionchange = function (direction) {
                        compare = (direction === "next" ? ascending : descending);
                        if (isCompound) compare = compoundCompare(compare);
                        set.sort(compare);
                    };
                    var i = 0;
                    c._addAlgorithm(function (cursor, advance, resolve) {
                        var key = cursor.key;
                        while (compare(key, set[i]) > 0) {
                            // The cursor has passed beyond this key. Check next.
                            ++i;
                            if (i === set.length) {
                                // There is no next. Stop searching.
                                advance(resolve);
                                return false;
                            }
                        }
                        if (compare(key, set[i]) === 0) {
                            // The current cursor value should be included and we should continue a single step in case next item has the same key or possibly our next key in set.
                            advance(function () { cursor.continue(); });
                            return true;
                        } else {
                            // cursor.key not yet at set[i]. Forward cursor to the next key to hunt for.
                            advance(function () { cursor.continue(set[i]); });
                            return false;
                        }
                    });
                    return c;
                },

                notEqual: function(value) {
                    return this.below(value).or(this._ctx.index).above(value);
                },

                noneOf: function(valueArray) {
                    var ctx = this._ctx,
                        schema = ctx.table.schema;
                    var idxSpec = ctx.index ? schema.idxByName[ctx.index] : schema.primKey;
                    var isCompound = idxSpec && idxSpec.compound;
                    var set = getSetArgs(arguments);
                    if (set.length === 0) return new this._ctx.collClass(this); // Return entire collection.
                    var compare = isCompound ? compoundCompare(ascending) : ascending;
                    set.sort(compare);
                    // Transform ["a","b","c"] to a set of ranges for between/above/below: [[null,"a"], ["a","b"], ["b","c"], ["c",null]]
                    var ranges = set.reduce(function (res, val) { return res ? res.concat([[res[res.length - 1][1], val]]) : [[null, val]]; }, null);
                    ranges.push([set[set.length - 1], null]);
                    // Transform range-sets to a big or() expression between ranges:
                    var thiz = this, index = ctx.index;
                    return ranges.reduce(function(collection, range) {
                        return collection ?
                            range[1] === null ?
                                collection.or(index).above(range[0]) :
                                collection.or(index).between(range[0], range[1], false, false)
                            : thiz.below(range[1]);
                    }, null);
                },

                startsWithAnyOf: function (valueArray) {
                    var ctx = this._ctx,
                        set = getSetArgs(arguments);

                    if (!set.every(function (s) { return typeof s === 'string'; })) {
                        return fail(new ctx.collClass(this), new TypeError("startsWithAnyOf() only works with strings"));
                    }
                    if (set.length === 0) return new ctx.collClass(this, function () { return IDBKeyRange.only(""); }).limit(0); // Return an empty collection.

                    var setEnds = set.map(function (s) { return s + String.fromCharCode(65535); });
                    
                    var sortDirection = ascending;
                    set.sort(sortDirection);
                    var i = 0;
                    function keyIsBeyondCurrentEntry(key) { return key > setEnds[i]; }
                    function keyIsBeforeCurrentEntry(key) { return key < set[i]; }
                    var checkKey = keyIsBeyondCurrentEntry;

                    var c = new ctx.collClass(this, function () {
                        return IDBKeyRange.bound(set[0], set[set.length - 1] + String.fromCharCode(65535));
                    });
                    
                    c._ondirectionchange = function (direction) {
                        if (direction === "next") {
                            checkKey = keyIsBeyondCurrentEntry;
                            sortDirection = ascending;
                        } else {
                            checkKey = keyIsBeforeCurrentEntry;
                            sortDirection = descending;
                        }
                        set.sort(sortDirection);
                        setEnds.sort(sortDirection);
                    };

                    c._addAlgorithm(function (cursor, advance, resolve) {
                        var key = cursor.key;
                        while (checkKey(key)) {
                            // The cursor has passed beyond this key. Check next.
                            ++i;
                            if (i === set.length) {
                                // There is no next. Stop searching.
                                advance(resolve);
                                return false;
                            }
                        }
                        if (key >= set[i] && key <= setEnds[i]) {
                            // The current cursor value should be included and we should continue a single step in case next item has the same key or possibly our next key in set.
                            advance(function () { cursor.continue(); });
                            return true;
                        } else {
                            // cursor.key not yet at set[i]. Forward cursor to the next key to hunt for.
                            advance(function() {
                                if (sortDirection === ascending) cursor.continue(set[i]);
                                else cursor.continue(setEnds[i]);
                            });
                            return false;
                        }
                    });
                    return c;
                }
            };
        });




        //
        //
        //
        // Collection Class
        //
        //
        //
        function Collection(whereClause, keyRangeGenerator) {
            /// <summary>
            /// 
            /// </summary>
            /// <param name="whereClause" type="WhereClause">Where clause instance</param>
            /// <param name="keyRangeGenerator" value="function(){ return IDBKeyRange.bound(0,1);}" optional="true"></param>
            var keyRange = null, error = null;
            if (keyRangeGenerator) try {
                keyRange = keyRangeGenerator();
            } catch (ex) {
                error = ex;
            }

            var whereCtx = whereClause._ctx;
            this._ctx = {
                table: whereCtx.table,
                index: whereCtx.index,
                isPrimKey: (!whereCtx.index || (whereCtx.table.schema.primKey.keyPath && whereCtx.index === whereCtx.table.schema.primKey.name)),
                range: keyRange,
                op: "openCursor",
                dir: "next",
                unique: "",
                algorithm: null,
                filter: null,
                isMatch: null,
                offset: 0,
                limit: Infinity,
                error: error, // If set, any promise must be rejected with this error
                or: whereCtx.or
            };
        }

        extend(Collection.prototype, function () {

            //
            // Collection Private Functions
            //

            function addFilter(ctx, fn) {
                ctx.filter = combine(ctx.filter, fn);
            }

            function addMatchFilter(ctx, fn) {
                ctx.isMatch = combine(ctx.isMatch, fn);
            }

            function getIndexOrStore(ctx, store) {
                if (ctx.isPrimKey) return store;
                var indexSpec = ctx.table.schema.idxByName[ctx.index];
                if (!indexSpec) throw new Error("KeyPath " + ctx.index + " on object store " + store.name + " is not indexed");
                return ctx.isPrimKey ? store : store.index(indexSpec.name);
            }

            function openCursor(ctx, store) {
                return getIndexOrStore(ctx, store)[ctx.op](ctx.range || null, ctx.dir + ctx.unique);
            }

            function iter(ctx, fn, resolve, reject, idbstore) {
                if (!ctx.or) {
                    iterate(openCursor(ctx, idbstore), combine(ctx.algorithm, ctx.filter), fn, resolve, reject, ctx.table.hook.reading.fire);
                } else {
                    (function () {
                        var filter = ctx.filter;
                        var set = {};
                        var primKey = ctx.table.schema.primKey.keyPath;
                        var resolved = 0;

                        function resolveboth() {
                            if (++resolved === 2) resolve(); // Seems like we just support or btwn max 2 expressions, but there are no limit because we do recursion.
                        }

                        function union(item, cursor, advance) {
                            if (!filter || filter(cursor, advance, resolveboth, reject)) {
                                var key = cursor.primaryKey.toString(); // Converts any Date to String, String to String, Number to String and Array to comma-separated string
                                if (!set.hasOwnProperty(key)) {
                                    set[key] = true;
                                    fn(item, cursor, advance);
                                }
                            }
                        }

                        ctx.or._iterate(union, resolveboth, reject, idbstore);
                        iterate(openCursor(ctx, idbstore), ctx.algorithm, union, resolveboth, reject, ctx.table.hook.reading.fire);
                    })();
                }
            }
            function getInstanceTemplate(ctx) {
                return ctx.table.schema.instanceTemplate;
            }


            return {

                //
                // Collection Protected Functions
                //

                _read: function (fn, cb) {
                    var ctx = this._ctx;
                    if (ctx.error)
                        return ctx.table._trans(null, function rejector(resolve, reject) { reject(ctx.error); });
                    else
                        return ctx.table._idbstore(READONLY, fn).then(cb);
                },
                _write: function (fn) {
                    var ctx = this._ctx;
                    if (ctx.error)
                        return ctx.table._trans(null, function rejector(resolve, reject) { reject(ctx.error); });
                    else
                        return ctx.table._idbstore(READWRITE, fn, "locked"); // When doing write operations on collections, always lock the operation so that upcoming operations gets queued.
                },
                _addAlgorithm: function (fn) {
                    var ctx = this._ctx;
                    ctx.algorithm = combine(ctx.algorithm, fn);
                },

                _iterate: function (fn, resolve, reject, idbstore) {
                    return iter(this._ctx, fn, resolve, reject, idbstore);
                },

                //
                // Collection Public methods
                //

                each: function (fn) {
                    var ctx = this._ctx;

                    fake && fn(getInstanceTemplate(ctx));

                    return this._read(function (resolve, reject, idbstore) {
                        iter(ctx, fn, resolve, reject, idbstore);
                    });
                },

                count: function (cb) {
                    if (fake) return Promise.resolve(0).then(cb);
                    var self = this,
                        ctx = this._ctx;

                    if (ctx.filter || ctx.algorithm || ctx.or) {
                        // When filters are applied or 'ored' collections are used, we must count manually
                        var count = 0;
                        return this._read(function (resolve, reject, idbstore) {
                            iter(ctx, function () { ++count; return false; }, function () { resolve(count); }, reject, idbstore);
                        }, cb);
                    } else {
                        // Otherwise, we can use the count() method if the index.
                        return this._read(function (resolve, reject, idbstore) {
                            var idx = getIndexOrStore(ctx, idbstore);
                            var req = (ctx.range ? idx.count(ctx.range) : idx.count());
                            req.onerror = eventRejectHandler(reject, ["calling", "count()", "on", self.name]);
                            req.onsuccess = function (e) {
                                resolve(Math.min(e.target.result, Math.max(0, ctx.limit - ctx.offset)));
                            };
                        }, cb);
                    }
                },

                sortBy: function (keyPath, cb) {
                    /// <param name="keyPath" type="String"></param>
                    var ctx = this._ctx;
                    var parts = keyPath.split('.').reverse(),
                        lastPart = parts[0],
                        lastIndex = parts.length - 1;
                    function getval(obj, i) {
                        if (i) return getval(obj[parts[i]], i - 1);
                        return obj[lastPart];
                    }
                    var order = this._ctx.dir === "next" ? 1 : -1;

                    function sorter(a, b) {
                        var aVal = getval(a, lastIndex),
                            bVal = getval(b, lastIndex);
                        return aVal < bVal ? -order : aVal > bVal ? order : 0;
                    }
                    return this.toArray(function (a) {
                        return a.sort(sorter);
                    }).then(cb);
                },

                toArray: function (cb) {
                    var ctx = this._ctx;
                    return this._read(function (resolve, reject, idbstore) {
                        fake && resolve([getInstanceTemplate(ctx)]);
                        var a = [];
                        iter(ctx, function (item) { a.push(item); }, function arrayComplete() {
                            resolve(a);
                        }, reject, idbstore);
                    }, cb);
                },

                offset: function (offset) {
                    var ctx = this._ctx;
                    if (offset <= 0) return this;
                    ctx.offset += offset; // For count()
                    if (!ctx.or && !ctx.algorithm && !ctx.filter) {
                        addFilter(ctx, function offsetFilter(cursor, advance, resolve) {
                            if (offset === 0) return true;
                            if (offset === 1) { --offset; return false; }
                            advance(function () { cursor.advance(offset); offset = 0; });
                            return false;
                        });
                    } else {
                        addFilter(ctx, function offsetFilter(cursor, advance, resolve) {
                            return (--offset < 0);
                        });
                    }
                    return this;
                },

                limit: function (numRows) {
                    this._ctx.limit = Math.min(this._ctx.limit, numRows); // For count()
                    addFilter(this._ctx, function (cursor, advance, resolve) {
                        if (--numRows <= 0) advance(resolve); // Stop after this item has been included
                        return numRows >= 0; // If numRows is already below 0, return false because then 0 was passed to numRows initially. Otherwise we wouldnt come here.
                    });
                    return this;
                },

                until: function (filterFunction, bIncludeStopEntry) {
                    var ctx = this._ctx;
                    fake && filterFunction(getInstanceTemplate(ctx));
                    addFilter(this._ctx, function (cursor, advance, resolve) {
                        if (filterFunction(cursor.value)) {
                            advance(resolve);
                            return bIncludeStopEntry;
                        } else {
                            return true;
                        }
                    });
                    return this;
                },

                first: function (cb) {
                    return this.limit(1).toArray(function (a) { return a[0]; }).then(cb);
                },

                last: function (cb) {
                    return this.reverse().first(cb);
                },

                and: function (filterFunction) {
                    /// <param name="jsFunctionFilter" type="Function">function(val){return true/false}</param>
                    fake && filterFunction(getInstanceTemplate(this._ctx));
                    addFilter(this._ctx, function (cursor) {
                        return filterFunction(cursor.value);
                    });
                    addMatchFilter(this._ctx, filterFunction); // match filters not used in Dexie.js but can be used by 3rd part libraries to test a collection for a match without querying DB. Used by Dexie.Observable.
                    return this;
                },

                or: function (indexName) {
                    return new WhereClause(this._ctx.table, indexName, this);
                },

                reverse: function () {
                    this._ctx.dir = (this._ctx.dir === "prev" ? "next" : "prev");
                    if (this._ondirectionchange) this._ondirectionchange(this._ctx.dir);
                    return this;
                },

                desc: function () {
                    return this.reverse();
                },

                eachKey: function (cb) {
                    var ctx = this._ctx;
                    fake && cb(getByKeyPath(getInstanceTemplate(this._ctx), this._ctx.index ? this._ctx.table.schema.idxByName[this._ctx.index].keyPath : this._ctx.table.schema.primKey.keyPath));
                    if (!ctx.isPrimKey) ctx.op = "openKeyCursor"; // Need the check because IDBObjectStore does not have "openKeyCursor()" while IDBIndex has.
                    return this.each(function (val, cursor) { cb(cursor.key, cursor); });
                },

                eachUniqueKey: function (cb) {
                    this._ctx.unique = "unique";
                    return this.eachKey(cb);
                },

                keys: function (cb) {
                    var ctx = this._ctx;
                    if (!ctx.isPrimKey) ctx.op = "openKeyCursor"; // Need the check because IDBObjectStore does not have "openKeyCursor()" while IDBIndex has.
                    var a = [];
                    if (fake) return new Promise(this.eachKey.bind(this)).then(function(x) { return [x]; }).then(cb);
                    return this.each(function (item, cursor) {
                        a.push(cursor.key);
                    }).then(function () {
                        return a;
                    }).then(cb);
                },

                uniqueKeys: function (cb) {
                    this._ctx.unique = "unique";
                    return this.keys(cb);
                },

                firstKey: function (cb) {
                    return this.limit(1).keys(function (a) { return a[0]; }).then(cb);
                },

                lastKey: function (cb) {
                    return this.reverse().firstKey(cb);
                },


                distinct: function () {
                    var set = {};
                    addFilter(this._ctx, function (cursor) {
                        var strKey = cursor.primaryKey.toString(); // Converts any Date to String, String to String, Number to String and Array to comma-separated string
                        var found = set.hasOwnProperty(strKey);
                        set[strKey] = true;
                        return !found;
                    });
                    return this;
                }
            };
        });

        //
        //
        // WriteableCollection Class
        //
        //
        function WriteableCollection() {
            Collection.apply(this, arguments);
        }

        derive(WriteableCollection).from(Collection).extend({

            //
            // WriteableCollection Public Methods
            //

            modify: function (changes) {
                var self = this,
                    ctx = this._ctx,
                    hook = ctx.table.hook,
                    updatingHook = hook.updating.fire,
                    deletingHook = hook.deleting.fire;

                fake && typeof changes === 'function' && changes.call({ value: ctx.table.schema.instanceTemplate }, ctx.table.schema.instanceTemplate);

                return this._write(function (resolve, reject, idbstore, trans) {
                    var modifyer;
                    if (typeof changes === 'function') {
                        // Changes is a function that may update, add or delete propterties or even require a deletion the object itself (delete this.item)
                        if (updatingHook === nop && deletingHook === nop) {
                            // Noone cares about what is being changed. Just let the modifier function be the given argument as is.
                            modifyer = changes;
                        } else {
                            // People want to know exactly what is being modified or deleted.
                            // Let modifyer be a proxy function that finds out what changes the caller is actually doing
                            // and call the hooks accordingly!
                            modifyer = function (item) {
                                var origItem = deepClone(item); // Clone the item first so we can compare laters.
                                if (changes.call(this, item) === false) return false; // Call the real modifyer function (If it returns false explicitely, it means it dont want to modify anyting on this object)
                                if (!this.hasOwnProperty("value")) {
                                    // The real modifyer function requests a deletion of the object. Inform the deletingHook that a deletion is taking place.
                                    deletingHook.call(this, this.primKey, item, trans);
                                } else {
                                    // No deletion. Check what was changed
                                    var objectDiff = getObjectDiff(origItem, this.value);
                                    var additionalChanges = updatingHook.call(this, objectDiff, this.primKey, origItem, trans);
                                    if (additionalChanges) {
                                        // Hook want to apply additional modifications. Make sure to fullfill the will of the hook.
                                        item = this.value;
                                        Object.keys(additionalChanges).forEach(function (keyPath) {
                                            setByKeyPath(item, keyPath, additionalChanges[keyPath]);  // Adding {keyPath: undefined} means that the keyPath should be deleted. Handled by setByKeyPath
                                        });
                                    }
                                }
                            }; 
                        }
                    } else if (updatingHook === nop) {
                        // changes is a set of {keyPath: value} and no one is listening to the updating hook.
                        var keyPaths = Object.keys(changes);
                        var numKeys = keyPaths.length;
                        modifyer = function (item) {
                            var anythingModified = false;
                            for (var i = 0; i < numKeys; ++i) {
                                var keyPath = keyPaths[i], val = changes[keyPath];
                                if (getByKeyPath(item, keyPath) !== val) {
                                    setByKeyPath(item, keyPath, val); // Adding {keyPath: undefined} means that the keyPath should be deleted. Handled by setByKeyPath
                                    anythingModified = true;
                                }
                            }
                            return anythingModified;
                        }; 
                    } else {
                        // changes is a set of {keyPath: value} and people are listening to the updating hook so we need to call it and
                        // allow it to add additional modifications to make.
                        var origChanges = changes;
                        changes = shallowClone(origChanges); // Let's work with a clone of the changes keyPath/value set so that we can restore it in case a hook extends it.
                        modifyer = function (item) {
                            var anythingModified = false;
                            var additionalChanges = updatingHook.call(this, changes, this.primKey, deepClone(item), trans);
                            if (additionalChanges) extend(changes, additionalChanges);
                            Object.keys(changes).forEach(function (keyPath) {
                                var val = changes[keyPath];
                                if (getByKeyPath(item, keyPath) !== val) {
                                    setByKeyPath(item, keyPath, val);
                                    anythingModified = true;
                                }
                            });
                            if (additionalChanges) changes = shallowClone(origChanges); // Restore original changes for next iteration
                            return anythingModified;
                        }; 
                    }

                    var count = 0;
                    var successCount = 0;
                    var iterationComplete = false;
                    var failures = [];
                    var failKeys = [];
                    var currentKey = null;

                    function modifyItem(item, cursor, advance) {
                        currentKey = cursor.primaryKey;
                        var thisContext = { primKey: cursor.primaryKey, value: item };
                        if (modifyer.call(thisContext, item) !== false) { // If a callback explicitely returns false, do not perform the update!
                            var bDelete = !thisContext.hasOwnProperty("value");
                            var req = (bDelete ? cursor.delete() : cursor.update(thisContext.value));
                            ++count;
                            req.onerror = eventRejectHandler(function (e) {
                                failures.push(e);
                                failKeys.push(thisContext.primKey);
                                if (thisContext.onerror) thisContext.onerror(e);
                                checkFinished();
                                return true; // Catch these errors and let a final rejection decide whether or not to abort entire transaction
                            }, bDelete ? ["deleting", item, "from", ctx.table.name] : ["modifying", item, "on", ctx.table.name]);
                            req.onsuccess = function (ev) {
                                if (thisContext.onsuccess) thisContext.onsuccess(thisContext.value);
                                ++successCount;
                                checkFinished();
                            }; 
                        } else if (thisContext.onsuccess) {
                            // Hook will expect either onerror or onsuccess to always be called!
                            thisContext.onsuccess(thisContext.value);
                        }
                    }

                    function doReject(e) {
                        if (e) {
                            failures.push(e);
                            failKeys.push(currentKey);
                        }
                        return reject(new ModifyError("Error modifying one or more objects", failures, successCount, failKeys));
                    }

                    function checkFinished() {
                        if (iterationComplete && successCount + failures.length === count) {
                            if (failures.length > 0)
                                doReject();
                            else
                                resolve(successCount);
                        }
                    }
                    self._iterate(modifyItem, function () {
                        iterationComplete = true;
                        checkFinished();
                    }, doReject, idbstore);
                });
            },

            'delete': function () {
                return this.modify(function () { delete this.value; });
            }
        });


        //
        //
        //
        // ------------------------- Help functions ---------------------------
        //
        //
        //

        function lowerVersionFirst(a, b) {
            return a._cfg.version - b._cfg.version;
        }

        function setApiOnPlace(objs, transactionPromiseFactory, tableNames, mode, dbschema, enableProhibitedDB) {
            tableNames.forEach(function (tableName) {
                var tableInstance = db._tableFactory(mode, dbschema[tableName], transactionPromiseFactory);
                objs.forEach(function (obj) {
                    if (!obj[tableName]) {
                        if (enableProhibitedDB) {
                            Object.defineProperty(obj, tableName, {
                                configurable: true,
                                enumerable: true,
                                get: function () {
									var currentTrans = Promise.PSD && Promise.PSD.trans;
                                    if (currentTrans && currentTrans.db === db) {
                                        return currentTrans.tables[tableName];
                                    }
                                    return tableInstance;
                                }
                            });
                        } else {
                            obj[tableName] = tableInstance;
                        }
                    }
                });
            });
        }

        function removeTablesApi(objs) {
            objs.forEach(function (obj) {
                for (var key in obj) {
                    if (obj[key] instanceof Table) delete obj[key];
                }
            });
        }

        function iterate(req, filter, fn, resolve, reject, readingHook) {
            var psd = Promise.PSD;
            readingHook = readingHook || mirror;
            if (!req.onerror) req.onerror = eventRejectHandler(reject);
            if (filter) {
                req.onsuccess = trycatch(function filter_record(e) {
                    var cursor = req.result;
                    if (cursor) {
                        var c = function () { cursor.continue(); };
                        if (filter(cursor, function (advancer) { c = advancer; }, resolve, reject))
                            fn(readingHook(cursor.value), cursor, function (advancer) { c = advancer; });
                        c();
                    } else {
                        resolve();
                    }
                }, reject, psd);
            } else {
                req.onsuccess = trycatch(function filter_record(e) {
                    var cursor = req.result;
                    if (cursor) {
                        var c = function () { cursor.continue(); };
                        fn(readingHook(cursor.value), cursor, function (advancer) { c = advancer; });
                        c();
                    } else {
                        resolve();
                    }
                }, reject, psd);
            }
        }

        function parseIndexSyntax(indexes) {
            /// <param name="indexes" type="String"></param>
            /// <returns type="Array" elementType="IndexSpec"></returns>
            var rv = [];
            indexes.split(',').forEach(function (index) {
                index = index.trim();
                var name = index.replace("&", "").replace("++", "").replace("*", "");
                var keyPath = (name.indexOf('[') !== 0 ? name : index.substring(index.indexOf('[') + 1, index.indexOf(']')).split('+'));

                rv.push(new IndexSpec(
                    name,
                    keyPath || null,
                    index.indexOf('&') !== -1,
                    index.indexOf('*') !== -1,
                    index.indexOf("++") !== -1,
                    Array.isArray(keyPath),
                    keyPath.indexOf('.') !== -1
                ));
            });
            return rv;
        }

        function ascending(a, b) {
            return a < b ? -1 : a > b ? 1 : 0;
        }

        function descending(a, b) {
            return a < b ? 1 : a > b ? -1 : 0;
        }

        function compoundCompare(itemCompare) {
            return function (a, b) {
                var i = 0;
                while (true) {
                    var result = itemCompare(a[i], b[i]);
                    if (result !== 0) return result;
                    ++i;
                    if (i === a.length || i === b.length)
                        return itemCompare(a.length, b.length);
                }
            };
        }

        function combine(filter1, filter2) {
            return filter1 ? filter2 ? function () { return filter1.apply(this, arguments) && filter2.apply(this, arguments); } : filter1 : filter2;
        }

        function hasIEDeleteObjectStoreBug() {
            // Assume bug is present in IE10 and IE11 but dont expect it in next version of IE (IE12)
            return navigator.userAgent.indexOf("Trident") >= 0 || navigator.userAgent.indexOf("MSIE") >= 0;
        }

        function readGlobalSchema() {
            db.verno = idbdb.version / 10;
            db._dbSchema = globalSchema = {};
            dbStoreNames = [].slice.call(idbdb.objectStoreNames, 0);
            if (dbStoreNames.length === 0) return; // Database contains no stores.
            var trans = idbdb.transaction(safariMultiStoreFix(dbStoreNames), 'readonly');
            dbStoreNames.forEach(function (storeName) {
                var store = trans.objectStore(storeName),
                    keyPath = store.keyPath,
                    dotted = keyPath && typeof keyPath === 'string' && keyPath.indexOf('.') !== -1;
                var primKey = new IndexSpec(keyPath, keyPath || "", false, false, !!store.autoIncrement, keyPath && typeof keyPath !== 'string', dotted);
                var indexes = [];
                for (var j = 0; j < store.indexNames.length; ++j) {
                    var idbindex = store.index(store.indexNames[j]);
                    keyPath = idbindex.keyPath;
                    dotted = keyPath && typeof keyPath === 'string' && keyPath.indexOf('.') !== -1;
                    var index = new IndexSpec(idbindex.name, keyPath, !!idbindex.unique, !!idbindex.multiEntry, false, keyPath && typeof keyPath !== 'string', dotted);
                    indexes.push(index);
                }
                globalSchema[storeName] = new TableSchema(storeName, primKey, indexes, {});
            });
            setApiOnPlace([allTables], db._transPromiseFactory, Object.keys(globalSchema), READWRITE, globalSchema);
        }

        function adjustToExistingIndexNames(schema, idbtrans) {
            /// <summary>
            /// Issue #30 Problem with existing db - adjust to existing index names when migrating from non-dexie db
            /// </summary>
            /// <param name="schema" type="Object">Map between name and TableSchema</param>
            /// <param name="idbtrans" type="IDBTransaction"></param>
            var storeNames = idbtrans.db.objectStoreNames;
            for (var i = 0; i < storeNames.length; ++i) {
                var storeName = storeNames[i];
                var store = idbtrans.objectStore(storeName);
                for (var j = 0; j < store.indexNames.length; ++j) {
                    var indexName = store.indexNames[j];
                    var keyPath = store.index(indexName).keyPath;
                    var dexieName = typeof keyPath === 'string' ? keyPath : "[" + [].slice.call(keyPath).join('+') + "]";
                    if (schema[storeName]) {
                        var indexSpec = schema[storeName].idxByName[dexieName];
                        if (indexSpec) indexSpec.name = indexName;
                    }
                }
            }
        }

        extend(this, {
            Collection: Collection,
            Table: Table,
            Transaction: Transaction,
            Version: Version,
            WhereClause: WhereClause,
            WriteableCollection: WriteableCollection,
            WriteableTable: WriteableTable
        });

        init();

        addons.forEach(function (fn) {
            fn(db);
        });
    }

    //
    // Promise Class
    //
    // A variant of promise-light (https://github.com/taylorhakes/promise-light) by https://github.com/taylorhakes - an A+ and ECMASCRIPT 6 compliant Promise implementation.
    //
    // Modified by David Fahlander to be indexedDB compliant (See discussion: https://github.com/promises-aplus/promises-spec/issues/45) .
    // This implementation will not use setTimeout or setImmediate when it's not needed. The behavior is 100% Promise/A+ compliant since
    // the caller of new Promise() can be certain that the promise wont be triggered the lines after constructing the promise. We fix this by using the member variable constructing to check
    // whether the object is being constructed when reject or resolve is called. If so, the use setTimeout/setImmediate to fulfill the promise, otherwise, we know that it's not needed.
    //
    // This topic was also discussed in the following thread: https://github.com/promises-aplus/promises-spec/issues/45 and this implementation solves that issue.
    //
    // Another feature with this Promise implementation is that reject will return false in case no one catched the reject call. This is used
    // to stopPropagation() on the IDBRequest error event in case it was catched but not otherwise.
    //
    // Also, the event new Promise().onuncatched is called in case no one catches a reject call. This is used for us to manually bubble any request
    // errors to the transaction. We must not rely on IndexedDB implementation to do this, because it only does so when the source of the rejection
    // is an error event on a request, not in case an ordinary exception is thrown.
    var Promise = (function () {

        // The use of asap in handle() is remarked because we must NOT use setTimeout(fn,0) because it causes premature commit of indexedDB transactions - which is according to indexedDB specification.
        var _slice = [].slice;
        var _asap = typeof setImmediate === 'undefined' ? function(fn, arg1, arg2, argN) {
            var args = arguments;
            setTimeout(function() { fn.apply(global, _slice.call(args, 1)); }, 0); // If not FF13 and earlier failed, we could use this call here instead: setTimeout.call(this, [fn, 0].concat(arguments));
        } : setImmediate; // IE10+ and node.

        doFakeAutoComplete(function () {
            // Simplify the job for VS Intellisense. This piece of code is one of the keys to the new marvellous intellisense support in Dexie.
            _asap = asap = enqueueImmediate = function(fn) {
                var args = arguments; setTimeout(function() { fn.apply(global, _slice.call(args, 1)); }, 0);
            };
        });

        var asap = _asap,
            isRootExecution = true;

        var operationsQueue = [];
        var tickFinalizers = [];
        function enqueueImmediate(fn, args) {
            operationsQueue.push([fn, _slice.call(arguments, 1)]);
        }

        function executeOperationsQueue() {
            var queue = operationsQueue;
            operationsQueue = [];
            for (var i = 0, l = queue.length; i < l; ++i) {
                var item = queue[i];
                item[0].apply(global, item[1]);
            }
        }

        //var PromiseID = 0;
        function Promise(fn) {
            if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
            if (typeof fn !== 'function') throw new TypeError('not a function');
            this._state = null; // null (=pending), false (=rejected) or true (=resolved)
            this._value = null; // error or result
            this._deferreds = [];
            this._catched = false; // for onuncatched
            //this._id = ++PromiseID;
            var self = this;
            var constructing = true;
            this._PSD = Promise.PSD;

            try {
                doResolve(this, fn, function (data) {
                    if (constructing)
                        asap(resolve, self, data);
                    else
                        resolve(self, data);
                }, function (reason) {
                    if (constructing) {
                        asap(reject, self, reason);
                        return false;
                    } else {
                        return reject(self, reason);
                    }
                });
            } finally {
                constructing = false;
            }
        }

        function handle(self, deferred) {
            if (self._state === null) {
                self._deferreds.push(deferred);
                return;
            }

            var cb = self._state ? deferred.onFulfilled : deferred.onRejected;
            if (cb === null) {
                // This Deferred doesnt have a listener for the event being triggered (onFulfilled or onReject) so lets forward the event to any eventual listeners on the Promise instance returned by then() or catch()
                return (self._state ? deferred.resolve : deferred.reject)(self._value);
            }
            var ret, isRootExec = isRootExecution;
            isRootExecution = false;
            asap = enqueueImmediate;
            try {
                var outerPSD = Promise.PSD;
                Promise.PSD = self._PSD;
                ret = cb(self._value);
                if (!self._state && (!ret || typeof ret.then !== 'function' || ret._state !== false)) setCatched(self); // Caller did 'return Promise.reject(err);' - don't regard it as catched!
                deferred.resolve(ret);
            } catch (e) {
                var catched = deferred.reject(e);
                if (!catched && self.onuncatched) {
                    try {
                        self.onuncatched(e);
                    } catch (e) {
                    }
                }
            } finally {
                Promise.PSD = outerPSD;
                if (isRootExec) {
                    do {
                        while (operationsQueue.length > 0) executeOperationsQueue();
                        var finalizer = tickFinalizers.pop();
                        if (finalizer) try {finalizer();} catch(e){}
                    } while (tickFinalizers.length > 0 || operationsQueue.length > 0);
                    asap = _asap;
                    isRootExecution = true;
                }
            }
        }

        function _rootExec(fn) {
            var isRootExec = isRootExecution;
            isRootExecution = false;
            asap = enqueueImmediate;
            try {
                fn();
            } finally {
                if (isRootExec) {
                    do {
                        while (operationsQueue.length > 0) executeOperationsQueue();
                        var finalizer = tickFinalizers.pop();
                        if (finalizer) try { finalizer(); } catch (e) { }
                    } while (tickFinalizers.length > 0 || operationsQueue.length > 0);
                    asap = _asap;
                    isRootExecution = true;
                }
            }
        }

        function setCatched(promise) {
            promise._catched = true;
            if (promise._parent) setCatched(promise._parent);
        }

        function resolve(promise, newValue) {
            var outerPSD = Promise.PSD;
            Promise.PSD = promise._PSD;
            try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
                if (newValue === promise) throw new TypeError('A promise cannot be resolved with itself.');
                if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
                    if (typeof newValue.then === 'function') {
                        doResolve(promise, function (resolve, reject) {
                            //newValue instanceof Promise ? newValue._then(resolve, reject) : newValue.then(resolve, reject);
                            newValue.then(resolve, reject);
                        }, function (data) {
                            resolve(promise, data);
                        }, function (reason) {
                            reject(promise, reason);
                        });
                        return;
                    }
                }
                promise._state = true;
                promise._value = newValue;
                finale.call(promise);
            } catch (e) { reject(e); } finally {
                Promise.PSD = outerPSD;
            }
        }

        function reject(promise, newValue) {
            var outerPSD = Promise.PSD;
            Promise.PSD = promise._PSD;
            promise._state = false;
            promise._value = newValue;

            finale.call(promise);
            if (!promise._catched) {
                try {
                    if (promise.onuncatched)
                        promise.onuncatched(promise._value);
                    Promise.on.error.fire(promise._value);
                } catch (e) {
                }
            }
            Promise.PSD = outerPSD;
            return promise._catched;
        }

        function finale() {
            for (var i = 0, len = this._deferreds.length; i < len; i++) {
                handle(this, this._deferreds[i]);
            }
            this._deferreds = [];
        }

        function Deferred(onFulfilled, onRejected, resolve, reject) {
            this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
            this.onRejected = typeof onRejected === 'function' ? onRejected : null;
            this.resolve = resolve;
            this.reject = reject;
        }

        /**
         * Take a potentially misbehaving resolver function and make sure
         * onFulfilled and onRejected are only called once.
         *
         * Makes no guarantees about asynchrony.
         */
        function doResolve(promise, fn, onFulfilled, onRejected) {
            var done = false;
            try {
                fn(function Promise_resolve(value) {
                    if (done) return;
                    done = true;
                    onFulfilled(value);
                }, function Promise_reject(reason) {
                    if (done) return promise._catched;
                    done = true;
                    return onRejected(reason);
                });
            } catch (ex) {
                if (done) return;
                return onRejected(ex);
            }
        }

        Promise.on = events(null, "error");

        Promise.all = function () {
            var args = Array.prototype.slice.call(arguments.length === 1 && Array.isArray(arguments[0]) ? arguments[0] : arguments);

            return new Promise(function (resolve, reject) {
                if (args.length === 0) return resolve([]);
                var remaining = args.length;
                function res(i, val) {
                    try {
                        if (val && (typeof val === 'object' || typeof val === 'function')) {
                            var then = val.then;
                            if (typeof then === 'function') {
                                then.call(val, function (val) { res(i, val); }, reject);
                                return;
                            }
                        }
                        args[i] = val;
                        if (--remaining === 0) {
                            resolve(args);
                        }
                    } catch (ex) {
                        reject(ex);
                    }
                }
                for (var i = 0; i < args.length; i++) {
                    res(i, args[i]);
                }
            });
        };

        /* Prototype Methods */
        Promise.prototype.then = function (onFulfilled, onRejected) {
            var self = this;
            var p = new Promise(function (resolve, reject) {
                if (self._state === null)
                    handle(self, new Deferred(onFulfilled, onRejected, resolve, reject));
                else
                    asap(handle, self, new Deferred(onFulfilled, onRejected, resolve, reject));
            });
            p._PSD = this._PSD;
            p.onuncatched = this.onuncatched; // Needed when exception occurs in a then() clause of a successful parent promise. Want onuncatched to be called even in callbacks of callbacks of the original promise.
            p._parent = this; // Used for recursively calling onuncatched event on self and all parents.
            return p;
        };

        Promise.prototype._then = function (onFulfilled, onRejected) {
            handle(this, new Deferred(onFulfilled, onRejected, nop,nop));
        };

        Promise.prototype['catch'] = function (onRejected) {
            if (arguments.length === 1) return this.then(null, onRejected);
            // First argument is the Error type to catch
            var type = arguments[0], callback = arguments[1];
            if (typeof type === 'function') return this.then(null, function (e) {
                // Catching errors by its constructor type (similar to java / c++ / c#)
                // Sample: promise.catch(TypeError, function (e) { ... });
                if (e instanceof type) return callback(e); else return Promise.reject(e);
            });
            else return this.then(null, function (e) {
                // Catching errors by the error.name property. Makes sense for indexedDB where error type
                // is always DOMError but where e.name tells the actual error type.
                // Sample: promise.catch('ConstraintError', function (e) { ... });
                if (e && e.name === type) return callback(e); else return Promise.reject(e);
            });
        };

        Promise.prototype['finally'] = function (onFinally) {
            return this.then(function (value) {
                onFinally();
                return value;
            }, function (err) {
                onFinally();
                return Promise.reject(err);
            });
        };

        Promise.prototype.onuncatched = null; // Optional event triggered if promise is rejected but no one listened.

        Promise.resolve = function (value) {
            var p = new Promise(function () { });
            p._state = true;
            p._value = value;
            return p;
        };

        Promise.reject = function (value) {
            var p = new Promise(function () { });
            p._state = false;
            p._value = value;
            return p;
        };

        Promise.race = function (values) {
            return new Promise(function (resolve, reject) {
                values.map(function (value) {
                    value.then(resolve, reject);
                });
            });
        };

        Promise.PSD = null; // Promise Specific Data - a TLS Pattern (Thread Local Storage) for Promises. TODO: Rename Promise.PSD to Promise.data

        Promise.newPSD = function (fn) {
            // Create new PSD scope (Promise Specific Data)
            var outerScope = Promise.PSD;
            Promise.PSD = outerScope ? Object.create(outerScope) : {};
            try {
                return fn();
            } finally {
                Promise.PSD = outerScope;
            }
        };

        Promise._rootExec = _rootExec;
        Promise._tickFinalize = function(callback) {
            if (isRootExecution) throw new Error("Not in a virtual tick");
            tickFinalizers.push(callback);
        };

        return Promise;
    })();


    //
    //
    // ------ Exportable Help Functions -------
    //
    //

    function nop() { }
    function mirror(val) { return val; }

    function pureFunctionChain(f1, f2) {
        // Enables chained events that takes ONE argument and returns it to the next function in chain.
        // This pattern is used in the hook("reading") event.
        if (f1 === mirror) return f2;
        return function (val) {
            return f2(f1(val));
        }; 
    }

    function callBoth(on1, on2) {
        return function () {
            on1.apply(this, arguments);
            on2.apply(this, arguments);
        }; 
    }

    function hookCreatingChain(f1, f2) {
        // Enables chained events that takes several arguments and may modify first argument by making a modification and then returning the same instance.
        // This pattern is used in the hook("creating") event.
        if (f1 === nop) return f2;
        return function () {
            var res = f1.apply(this, arguments);
            if (res !== undefined) arguments[0] = res;
            var onsuccess = this.onsuccess, // In case event listener has set this.onsuccess
                onerror = this.onerror;     // In case event listener has set this.onerror
            delete this.onsuccess;
            delete this.onerror;
            var res2 = f2.apply(this, arguments);
            if (onsuccess) this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
            if (onerror) this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
            return res2 !== undefined ? res2 : res;
        }; 
    }

    function hookUpdatingChain(f1, f2) {
        if (f1 === nop) return f2;
        return function () {
            var res = f1.apply(this, arguments);
            if (res !== undefined) extend(arguments[0], res); // If f1 returns new modifications, extend caller's modifications with the result before calling next in chain.
            var onsuccess = this.onsuccess, // In case event listener has set this.onsuccess
                onerror = this.onerror;     // In case event listener has set this.onerror
            delete this.onsuccess;
            delete this.onerror;
            var res2 = f2.apply(this, arguments);
            if (onsuccess) this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
            if (onerror) this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
            return res === undefined ?
                (res2 === undefined ? undefined : res2) :
                (res2 === undefined ? res : extend(res, res2));
        }; 
    }

    function stoppableEventChain(f1, f2) {
        // Enables chained events that may return false to stop the event chain.
        if (f1 === nop) return f2;
        return function () {
            if (f1.apply(this, arguments) === false) return false;
            return f2.apply(this, arguments);
        }; 
    }

    function reverseStoppableEventChain(f1, f2) {
        if (f1 === nop) return f2;
        return function () {
            if (f2.apply(this, arguments) === false) return false;
            return f1.apply(this, arguments);
        }; 
    }

    function nonStoppableEventChain(f1, f2) {
        if (f1 === nop) return f2;
        return function () {
            f1.apply(this, arguments);
            f2.apply(this, arguments);
        }; 
    }

    function promisableChain(f1, f2) {
        if (f1 === nop) return f2;
        return function () {
            var res = f1.apply(this, arguments);
            if (res && typeof res.then === 'function') {
                var thiz = this, args = arguments;
                return res.then(function () {
                    return f2.apply(thiz, args);
                });
            }
            return f2.apply(this, arguments);
        }; 
    }

    function events(ctx, eventNames) {
        var args = arguments;
        var evs = {};
        var rv = function (eventName, subscriber) {
            if (subscriber) {
                // Subscribe
                var args = [].slice.call(arguments, 1);
                var ev = evs[eventName];
                ev.subscribe.apply(ev, args);
                return ctx;
            } else if (typeof (eventName) === 'string') {
                // Return interface allowing to fire or unsubscribe from event
                return evs[eventName];
            }
        }; 
        rv.addEventType = add;

        function add(eventName, chainFunction, defaultFunction) {
            if (Array.isArray(eventName)) return addEventGroup(eventName);
            if (typeof eventName === 'object') return addConfiguredEvents(eventName);
            if (!chainFunction) chainFunction = stoppableEventChain;
            if (!defaultFunction) defaultFunction = nop;

            var context = {
                subscribers: [],
                fire: defaultFunction,
                subscribe: function (cb) {
                    context.subscribers.push(cb);
                    context.fire = chainFunction(context.fire, cb);
                },
                unsubscribe: function (cb) {
                    context.subscribers = context.subscribers.filter(function (fn) { return fn !== cb; });
                    context.fire = context.subscribers.reduce(chainFunction, defaultFunction);
                }
            };
            evs[eventName] = rv[eventName] = context;
            return context;
        }

        function addConfiguredEvents(cfg) {
            // events(this, {reading: [functionChain, nop]});
            Object.keys(cfg).forEach(function (eventName) {
                var args = cfg[eventName];
                if (Array.isArray(args)) {
                    add(eventName, cfg[eventName][0], cfg[eventName][1]);
                } else if (args === 'asap') {
                    // Rather than approaching event subscription using a functional approach, we here do it in a for-loop where subscriber is executed in its own stack
                    // enabling that any exception that occur wont disturb the initiator and also not nescessary be catched and forgotten.
                    var context = add(eventName, null, function fire() {
                        var args = arguments;
                        context.subscribers.forEach(function (fn) {
                            asap(function fireEvent() {
                                fn.apply(global, args);
                            });
                        });
                    });
                    context.subscribe = function (fn) {
                        // Change how subscribe works to not replace the fire function but to just add the subscriber to subscribers
                        if (context.subscribers.indexOf(fn) === -1)
                            context.subscribers.push(fn);
                    }; 
                    context.unsubscribe = function (fn) {
                        // Change how unsubscribe works for the same reason as above.
                        var idxOfFn = context.subscribers.indexOf(fn);
                        if (idxOfFn !== -1) context.subscribers.splice(idxOfFn, 1);
                    }; 
                } else throw new Error("Invalid event config");
            });
        }

        function addEventGroup(eventGroup) {
            // promise-based event group (i.e. we promise to call one and only one of the events in the pair, and to only call it once.
            var done = false;
            eventGroup.forEach(function (name) {
                add(name).subscribe(checkDone);
            });
            function checkDone() {
                if (done) return false;
                done = true;
            }
        }

        for (var i = 1, l = args.length; i < l; ++i) {
            add(args[i]);
        }

        return rv;
    }

    function assert(b) {
        if (!b) throw new Error("Assertion failed");
    }

    function asap(fn) {
        if (global.setImmediate) setImmediate(fn); else setTimeout(fn, 0);
    }

    var fakeAutoComplete = function () { };// Will never be changed. We just fake for the IDE that we change it (see doFakeAutoComplete())
    var fake = false; // Will never be changed. We just fake for the IDE that we change it (see doFakeAutoComplete())

    function doFakeAutoComplete(fn) {
        var to = setTimeout(fn, 1000);
        clearTimeout(to);
    }

    function trycatch(fn, reject, psd) {
        return function () {
            var outerPSD = Promise.PSD; // Support Promise-specific data (PSD) in callback calls
            Promise.PSD = psd;
            try {
                fn.apply(this, arguments);
            } catch (e) {
                reject(e);
            } finally {
                Promise.PSD = outerPSD;
            }
        };
    }

    function getByKeyPath(obj, keyPath) {
        // http://www.w3.org/TR/IndexedDB/#steps-for-extracting-a-key-from-a-value-using-a-key-path
        if (obj.hasOwnProperty(keyPath)) return obj[keyPath]; // This line is moved from last to first for optimization purpose.
        if (!keyPath) return obj;
        if (typeof keyPath !== 'string') {
            var rv = [];
            for (var i = 0, l = keyPath.length; i < l; ++i) {
                var val = getByKeyPath(obj, keyPath[i]);
                rv.push(val);
            }
            return rv;
        }
        var period = keyPath.indexOf('.');
        if (period !== -1) {
            var innerObj = obj[keyPath.substr(0, period)];
            return innerObj === undefined ? undefined : getByKeyPath(innerObj, keyPath.substr(period + 1));
        }
        return undefined;
    }

    function setByKeyPath(obj, keyPath, value) {
        if (!obj || keyPath === undefined) return;
        if (typeof keyPath !== 'string' && 'length' in keyPath) {
            assert(typeof value !== 'string' && 'length' in value);
            for (var i = 0, l = keyPath.length; i < l; ++i) {
                setByKeyPath(obj, keyPath[i], value[i]);
            }
        } else {
            var period = keyPath.indexOf('.');
            if (period !== -1) {
                var currentKeyPath = keyPath.substr(0, period);
                var remainingKeyPath = keyPath.substr(period + 1);
                if (remainingKeyPath === "")
                    if (value === undefined) delete obj[currentKeyPath]; else obj[currentKeyPath] = value;
                else {
                    var innerObj = obj[currentKeyPath];
                    if (!innerObj) innerObj = (obj[currentKeyPath] = {});
                    setByKeyPath(innerObj, remainingKeyPath, value);
                }
            } else {
                if (value === undefined) delete obj[keyPath]; else obj[keyPath] = value;
            }
        }
    }

    function delByKeyPath(obj, keyPath) {
        if (typeof keyPath === 'string')
            setByKeyPath(obj, keyPath, undefined);
        else if ('length' in keyPath)
            [].map.call(keyPath, function(kp) {
                 setByKeyPath(obj, kp, undefined);
            });
    }

    function shallowClone(obj) {
        var rv = {};
        for (var m in obj) {
            if (obj.hasOwnProperty(m)) rv[m] = obj[m];
        }
        return rv;
    }

    function deepClone(any) {
        if (!any || typeof any !== 'object') return any;
        var rv;
        if (Array.isArray(any)) {
            rv = [];
            for (var i = 0, l = any.length; i < l; ++i) {
                rv.push(deepClone(any[i]));
            }
        } else if (any instanceof Date) {
            rv = new Date();
            rv.setTime(any.getTime());
        } else {
            rv = any.constructor ? Object.create(any.constructor.prototype) : {};
            for (var prop in any) {
                if (any.hasOwnProperty(prop)) {
                    rv[prop] = deepClone(any[prop]);
                }
            }
        }
        return rv;
    }

    function getObjectDiff(a, b) {
        // This is a simplified version that will always return keypaths on the root level.
        // If for example a and b differs by: (a.somePropsObject.x != b.somePropsObject.x), we will return that "somePropsObject" is changed
        // and not "somePropsObject.x". This is acceptable and true but could be optimized to support nestled changes if that would give a
        // big optimization benefit.
        var rv = {};
        for (var prop in a) if (a.hasOwnProperty(prop)) {
            if (!b.hasOwnProperty(prop))
                rv[prop] = undefined; // Property removed
            else if (a[prop] !== b[prop] && JSON.stringify(a[prop]) != JSON.stringify(b[prop]))
                rv[prop] = b[prop]; // Property changed
        }
        for (var prop in b) if (b.hasOwnProperty(prop) && !a.hasOwnProperty(prop)) {
            rv[prop] = b[prop]; // Property added
        }
        return rv;
    }

    function parseType(type) {
        if (typeof type === 'function') {
            return new type();
        } else if (Array.isArray(type)) {
            return [parseType(type[0])];
        } else if (type && typeof type === 'object') {
            var rv = {};
            applyStructure(rv, type);
            return rv;
        } else {
            return type;
        }
    }

    function applyStructure(obj, structure) {
        Object.keys(structure).forEach(function (member) {
            var value = parseType(structure[member]);
            obj[member] = value;
        });
    }

    function eventRejectHandler(reject, sentance) {
        return function (event) {
            var errObj = (event && event.target.error) || new Error();
            if (sentance) {
                var occurredWhen = " occurred when " + sentance.map(function (word) {
                    switch (typeof (word)) {
                        case 'function': return word();
                        case 'string': return word;
                        default: return JSON.stringify(word);
                    }
                }).join(" ");
                if (errObj.name) {
                    errObj.toString = function toString() {
                        return errObj.name + occurredWhen + (errObj.message ? ". " + errObj.message : "");
                        // Code below works for stacked exceptions, BUT! stack is never present in event errors (not in any of the browsers). So it's no use to include it!
                        /*delete this.toString; // Prohibiting endless recursiveness in IE.
                        if (errObj.stack) rv += (errObj.stack ? ". Stack: " + errObj.stack : "");
                        this.toString = toString;
                        return rv;*/
                    };
                } else {
                    errObj = errObj + occurredWhen;
                }
            };
            reject(errObj);

            if (event) {// Old versions of IndexedDBShim doesnt provide an error event
                // Stop error from propagating to IDBTransaction. Let us handle that manually instead.
                if (event.stopPropagation) // IndexedDBShim doesnt support this
                    event.stopPropagation();
                if (event.preventDefault) // IndexedDBShim doesnt support this
                    event.preventDefault();
            }

            return false;
        };
    }

    function stack(error) {
        try {
            throw error;
        } catch (e) {
            return e;
        }
    }
    function preventDefault(e) {
        e.preventDefault();
    }

    function globalDatabaseList(cb) {
        var val,
            localStorage = Dexie.dependencies.localStorage;
        if (!localStorage) return cb([]); // Envs without localStorage support
        try {
            val = JSON.parse(localStorage.getItem('Dexie.DatabaseNames') || "[]");
        } catch (e) {
            val = [];
        }
        if (cb(val)) {
            localStorage.setItem('Dexie.DatabaseNames', JSON.stringify(val));
        }
    }

    //
    // IndexSpec struct
    //
    function IndexSpec(name, keyPath, unique, multi, auto, compound, dotted) {
        /// <param name="name" type="String"></param>
        /// <param name="keyPath" type="String"></param>
        /// <param name="unique" type="Boolean"></param>
        /// <param name="multi" type="Boolean"></param>
        /// <param name="auto" type="Boolean"></param>
        /// <param name="compound" type="Boolean"></param>
        /// <param name="dotted" type="Boolean"></param>
        this.name = name;
        this.keyPath = keyPath;
        this.unique = unique;
        this.multi = multi;
        this.auto = auto;
        this.compound = compound;
        this.dotted = dotted;
        var keyPathSrc = typeof keyPath === 'string' ? keyPath : keyPath && ('[' + [].join.call(keyPath, '+') + ']');
        this.src = (unique ? '&' : '') + (multi ? '*' : '') + (auto ? "++" : "") + keyPathSrc;
    }

    //
    // TableSchema struct
    //
    function TableSchema(name, primKey, indexes, instanceTemplate) {
        /// <param name="name" type="String"></param>
        /// <param name="primKey" type="IndexSpec"></param>
        /// <param name="indexes" type="Array" elementType="IndexSpec"></param>
        /// <param name="instanceTemplate" type="Object"></param>
        this.name = name;
        this.primKey = primKey || new IndexSpec();
        this.indexes = indexes || [new IndexSpec()];
        this.instanceTemplate = instanceTemplate;
        this.mappedClass = null;
        this.idxByName = indexes.reduce(function (hashSet, index) {
            hashSet[index.name] = index;
            return hashSet;
        }, {});
    }

    //
    // ModifyError Class (extends Error)
    //
    function ModifyError(msg, failures, successCount, failedKeys) {
        this.name = "ModifyError";
        this.failures = failures;
        this.failedKeys = failedKeys;
        this.successCount = successCount;
        this.message = failures.join('\n');
    }
    derive(ModifyError).from(Error);

    //
    // Static delete() method.
    //
    Dexie.delete = function (databaseName) {
        var db = new Dexie(databaseName),
            promise = db.delete();
        promise.onblocked = function (fn) {
            db.on("blocked", fn);
            return this;
        };
        return promise;
    };

    //
    // Static exists() method.
    //
    Dexie.exists = function(name) {
        return new Dexie(name).open().then(function(db) {
            db.close();
            return true;
        }, function() {
            return false;
        });
    }

    //
    // Static method for retrieving a list of all existing databases at current host.
    //
    Dexie.getDatabaseNames = function (cb) {
        return new Promise(function (resolve, reject) {
            var getDatabaseNames = getNativeGetDatabaseNamesFn();
            if (getDatabaseNames) { // In case getDatabaseNames() becomes standard, let's prepare to support it:
                var req = getDatabaseNames();
                req.onsuccess = function (event) {
                    resolve([].slice.call(event.target.result, 0)); // Converst DOMStringList to Array<String>
                }; 
                req.onerror = eventRejectHandler(reject);
            } else {
                globalDatabaseList(function (val) {
                    resolve(val);
                    return false;
                });
            }
        }).then(cb);
    }; 

    Dexie.defineClass = function (structure) {
        /// <summary>
        ///     Create a javascript constructor based on given template for which properties to expect in the class.
        ///     Any property that is a constructor function will act as a type. So {name: String} will be equal to {name: new String()}.
        /// </summary>
        /// <param name="structure">Helps IDE code completion by knowing the members that objects contain and not just the indexes. Also
        /// know what type each member has. Example: {name: String, emailAddresses: [String], properties: {shoeSize: Number}}</param>

        // Default constructor able to copy given properties into this object.
        function Class(properties) {
            /// <param name="properties" type="Object" optional="true">Properties to initialize object with.
            /// </param>
            properties ? extend(this, properties) : fake && applyStructure(this, structure);
        }
        return Class;
    }; 

    Dexie.ignoreTransaction = function (scopeFunc) {
        // In case caller is within a transaction but needs to create a separate transaction.
        // Example of usage:
        // 
        // Let's say we have a logger function in our app. Other application-logic should be unaware of the
        // logger function and not need to include the 'logentries' table in all transaction it performs.
        // The logging should always be done in a separate transaction and not be dependant on the current
        // running transaction context. Then you could use Dexie.ignoreTransaction() to run code that starts a new transaction.
        //
        //     Dexie.ignoreTransaction(function() {
        //         db.logentries.add(newLogEntry);
        //     });
        //
        // Unless using Dexie.ignoreTransaction(), the above example would try to reuse the current transaction
        // in current Promise-scope.
        //
        // An alternative to Dexie.ignoreTransaction() would be setImmediate() or setTimeout(). The reason we still provide an
        // API for this because
        //  1) The intention of writing the statement could be unclear if using setImmediate() or setTimeout().
        //  2) setTimeout() would wait unnescessary until firing. This is however not the case with setImmediate().
        //  3) setImmediate() is not supported in the ES standard.
        return Promise.newPSD(function () {
            Promise.PSD.trans = null;
            return scopeFunc();
        });
    };
    Dexie.spawn = function () {
        if (global.console) console.warn("Dexie.spawn() is deprecated. Use Dexie.ignoreTransaction() instead.");
        return Dexie.ignoreTransaction.apply(this, arguments);
    }

    Dexie.vip = function (fn) {
        // To be used by subscribers to the on('ready') event.
        // This will let caller through to access DB even when it is blocked while the db.ready() subscribers are firing.
        // This would have worked automatically if we were certain that the Provider was using Dexie.Promise for all asyncronic operations. The promise PSD
        // from the provider.connect() call would then be derived all the way to when provider would call localDatabase.applyChanges(). But since
        // the provider more likely is using non-promise async APIs or other thenable implementations, we cannot assume that.
        // Note that this method is only useful for on('ready') subscribers that is returning a Promise from the event. If not using vip()
        // the database could deadlock since it wont open until the returned Promise is resolved, and any non-VIPed operation started by
        // the caller will not resolve until database is opened.
        return Promise.newPSD(function () {
            Promise.PSD.letThrough = true; // Make sure we are let through if still blocking db due to onready is firing.
            return fn();
        });
    }; 

    // Dexie.currentTransaction property. Only applicable for transactions entered using the new "transact()" method.
    Object.defineProperty(Dexie, "currentTransaction", {
        get: function () {
            /// <returns type="Transaction"></returns>
            return Promise.PSD && Promise.PSD.trans || null;
        }
    }); 

    function safariMultiStoreFix(storeNames) {
        return storeNames.length === 1 ? storeNames[0] : storeNames;
    }

    // Export our Promise implementation since it can be handy as a standalone Promise implementation
    Dexie.Promise = Promise;
    // Export our derive/extend/override methodology
    Dexie.derive = derive;
    Dexie.extend = extend;
    Dexie.override = override;
    // Export our events() function - can be handy as a toolkit
    Dexie.events = events;
    Dexie.getByKeyPath = getByKeyPath;
    Dexie.setByKeyPath = setByKeyPath;
    Dexie.delByKeyPath = delByKeyPath;
    Dexie.shallowClone = shallowClone;
    Dexie.deepClone = deepClone;
    Dexie.addons = [];
    Dexie.fakeAutoComplete = fakeAutoComplete;
    Dexie.asap = asap;
    // Export our static classes
    Dexie.ModifyError = ModifyError;
    Dexie.MultiModifyError = ModifyError; // Backward compatibility pre 0.9.8
    Dexie.IndexSpec = IndexSpec;
    Dexie.TableSchema = TableSchema;
    //
    // Dependencies
    //
    // These will automatically work in browsers with indexedDB support, or where an indexedDB polyfill has been included.
    //
    // In node.js, however, these properties must be set "manually" before instansiating a new Dexie(). For node.js, you need to require indexeddb-js or similar and then set these deps.
    //
    var idbshim = global.idbModules && global.idbModules.shimIndexedDB ? global.idbModules : {};
    Dexie.dependencies = {
        // Required:
        // NOTE: The "_"-prefixed versions are for prioritizing IDB-shim on IOS8 before the native IDB in case the shim was included.
        indexedDB: idbshim.shimIndexedDB || global.indexedDB || global.mozIndexedDB || global.webkitIndexedDB || global.msIndexedDB,
        IDBKeyRange: idbshim.IDBKeyRange || global.IDBKeyRange || global.webkitIDBKeyRange,
        IDBTransaction: idbshim.IDBTransaction || global.IDBTransaction || global.webkitIDBTransaction,
        // Optional:
        Error: global.Error || String,
        SyntaxError: global.SyntaxError || String,
        TypeError: global.TypeError || String,
        DOMError: global.DOMError || String,
        localStorage: ((typeof chrome !== "undefined" && chrome !== null ? chrome.storage : void 0) != null ? null : global.localStorage)
    }; 

    // API Version Number: Type Number, make sure to always set a version number that can be comparable correctly. Example: 0.9, 0.91, 0.92, 1.0, 1.01, 1.1, 1.2, 1.21, etc.
    Dexie.version = 1.20;

    function getNativeGetDatabaseNamesFn() {
        var indexedDB = Dexie.dependencies.indexedDB;
        var fn = indexedDB && (indexedDB.getDatabaseNames || indexedDB.webkitGetDatabaseNames);
        return fn && fn.bind(indexedDB);
    }

    // Export Dexie to window or as a module depending on environment.
    publish("Dexie", Dexie);

    // Fool IDE to improve autocomplete. Tested with Visual Studio 2013 and 2015.
    doFakeAutoComplete(function() {
        Dexie.fakeAutoComplete = fakeAutoComplete = doFakeAutoComplete;
        Dexie.fake = fake = true;
    });
}).apply(null,

    // AMD:
    typeof define === 'function' && define.amd ?
    [self || window, function (name, value) { define(function () { return value; }); }] :

    // CommonJS:
    typeof global !== 'undefined' && typeof module !== 'undefined' && module.exports ?
    [global, function (name, value) { module.exports = value; }]

    // Vanilla HTML and WebWorkers:
    : [self || window, function (name, value) { (self || window)[name] = value; }]);


//Make a new database conection
var db = new Dexie('seshi');

//Define a schema
db.version(1)
    .stores({
        chunks: '[fileId+chunkNumber],*fileId, boxId'
    });

//Open the database
db.open()
    .catch(function(error){
        alert('Oh oh : ' + error);
    })

//SeshiSignalSerer datbase
var signalServerDb = new Dexie('seshiSignalServers');
signalServerDb.version(1)
	.stores({
		signalServers: '&address,lastSuccessfulConnectTimestamp, lastConnectAttempTimestamp,numFailedConnectAttempts'
	});
//Open the signal servers database
signalServerDb.open()
	.catch(function(error){
		alert('Oh no! : ' + error);
	})


/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
/* global mozRTCIceCandidate, mozRTCPeerConnection,
mozRTCSessionDescription, webkitRTCPeerConnection */
/* exported trace */

'use strict';

var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;

function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((window.performance.now() / 1000).toFixed(3) + ': ' + text);
}

function maybeFixConfiguration(pcConfig) {
  if (!pcConfig) {
    return;
  }
  for (var i = 0; i < pcConfig.iceServers.length; i++) {
    if (pcConfig.iceServers[i].hasOwnProperty('urls')) {
      pcConfig.iceServers[i].url = pcConfig.iceServers[i].urls;
      delete pcConfig.iceServers[i].urls;
    }
  }
}

if (navigator.mozGetUserMedia) {
  console.log('This appears to be Firefox');

  webrtcDetectedBrowser = 'firefox';

  webrtcDetectedVersion =
    parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

  // The RTCPeerConnection object.
  RTCPeerConnection = function(pcConfig, pcConstraints) {
    // .urls is not supported in FF yet.
    maybeFixConfiguration(pcConfig);
    return new mozRTCPeerConnection(pcConfig, pcConstraints);
  };

  // The RTCSessionDescription object.
  window.RTCSessionDescription = mozRTCSessionDescription;

  // The RTCIceCandidate object.
  window.RTCIceCandidate = mozRTCIceCandidate;

  // getUserMedia shim (only difference is the prefix).
  // Code from Adam Barth.
  getUserMedia = navigator.mozGetUserMedia.bind(navigator);
  navigator.getUserMedia = getUserMedia;

  // Creates ICE server from the URL for FF.
  window.createIceServer = function(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create ICE server with STUN URL.
      iceServer = {
        'url': url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      if (webrtcDetectedVersion < 27) {
        // Create iceServer with turn url.
        // Ignore the transport parameter from TURN url for FF version <=27.
        var turnUrlParts = url.split('?');
        // Return null for createIceServer if transport=tcp.
        if (turnUrlParts.length === 1 ||
          turnUrlParts[1].indexOf('transport=udp') === 0) {
          iceServer = {
            'url': turnUrlParts[0],
            'credential': password,
            'username': username
          };
        }
      } else {
        // FF 27 and above supports transport parameters in TURN url,
        // So passing in the full url to create iceServer.
        iceServer = {
          'url': url,
          'credential': password,
          'username': username
        };
      }
    }
    return iceServer;
  };

  window.createIceServers = function(urls, username, password) {
    var iceServers = [];
    // Use .url for FireFox.
    for (var i = 0; i < urls.length; i++) {
      var iceServer =
        window.createIceServer(urls[i], username, password);
      if (iceServer !== null) {
        iceServers.push(iceServer);
      }
    }
    return iceServers;
  };

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    console.log('Attaching media stream');
    element.mozSrcObject = stream;
  };

  reattachMediaStream = function(to, from) {
    console.log('Reattaching media stream');
    to.mozSrcObject = from.mozSrcObject;
  };

} else if (navigator.webkitGetUserMedia) {
  //console.log('This appears to be Chrome');

  webrtcDetectedBrowser = 'chrome';
  // Temporary fix until crbug/374263 is fixed.
  // Setting Chrome version to 999, if version is unavailable.
  var result = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
  if (result !== null) {
    webrtcDetectedVersion = parseInt(result[2], 10);
  } else {
    webrtcDetectedVersion = 999;
  }

  // Creates iceServer from the url for Chrome M33 and earlier.
  window.createIceServer = function(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = {
        'url': url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      // Chrome M28 & above uses below TURN format.
      iceServer = {
        'url': url,
        'credential': password,
        'username': username
      };
    }
    return iceServer;
  };

  // Creates iceServers from the urls for Chrome M34 and above.
  window.createIceServers = function(urls, username, password) {
    var iceServers = [];
    if (webrtcDetectedVersion >= 34) {
      // .urls is supported since Chrome M34.
      iceServers = {
        'urls': urls,
        'credential': password,
        'username': username
      };
    } else {
      for (var i = 0; i < urls.length; i++) {
        var iceServer =
          window.createIceServer(urls[i], username, password);
        if (iceServer !== null) {
          iceServers.push(iceServer);
        }
      }
    }
    return iceServers;
  };

  // The RTCPeerConnection object.
  RTCPeerConnection = function(pcConfig, pcConstraints) {
    // .urls is supported since Chrome M34.
    if (webrtcDetectedVersion < 34) {
      maybeFixConfiguration(pcConfig);
    }
    return new webkitRTCPeerConnection(pcConfig, pcConstraints);
  };

  // Get UserMedia (only difference is the prefix).
  // Code from Adam Barth.
  getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
  navigator.getUserMedia = getUserMedia;

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    if (typeof element.srcObject !== 'undefined') {
      element.srcObject = stream;
    } else if (typeof element.mozSrcObject !== 'undefined') {
      element.mozSrcObject = stream;
    } else if (typeof element.src !== 'undefined') {
      element.src = URL.createObjectURL(stream);
    } else {
      console.log('Error attaching stream to element.');
    }
  };

  reattachMediaStream = function(to, from) {
    to.src = from.src;
  };
} else {
  console.log('Browser does not appear to be WebRTC-capable');
}

// This code creates the client-side commands for an XML HTTP
// Request-based signaling channel for WebRTC.

// The signaling channel assumes a 2-person connection via a
// shared key.  Every connection attempt toggles the state
// between "waiting" and "connected", meaning that if 2 browsers
// are connected and another tries to connect the existing
// connection will be severed and the new browser will be
// "waiting".

var createSignalingChannel = function(key, handlers) {


var id, status, doNothing = function(){},
  handlers = handlers || {},
  initHandler = function(h) {
    return ((typeof h === 'function') && h) || doNothing;
  },
  waitingHandler = initHandler(handlers.onWaiting),
  connectedHandler = initHandler(handlers.onConnected),
  messageHandler = initHandler(handlers.onMessage);


// Set up connection with signaling server
function connect(failureCB) {
  var failureCB = (typeof failureCB === 'function') ||
                  function() {};

  // Handle connection response, which should be error or status
  //  of "connected" or "waiting"
  function handler() {
    if(this.readyState == this.DONE) {
      if(this.status == 200 && this.response != null) {
        var res = JSON.parse(this.response);
        if (res.err) {
          failureCB("error:  " + res.err);
          return;
        }

        // if no error, save status and server-generated id,
        // then start asynchronouse polling for messages
        id = res.id;
        status = res.status;
        poll();

        // run user-provided handlers for waiting and connected
        // states
        if (status === "waiting") {
          waitingHandler();
        } else {
	  connectedHandler();
      call();
        }
        return;
      } else {
        failureCB("HTTP error:  " + this.status);
        return;
      }
    }
  }

  // open XHR and send the connection request with the key
		 var client = new XMLHttpRequest();
		 client.onreadystatechange = handler;
		 client.open("GET", "https://signal.seshi.io/connect?key=" + Seshi.getKey());
		 client.send();
}//End connect()


// poll() waits n ms between gets to the server.  n is at 10 ms
// for 10 tries, then 100 ms for 10 tries, then 1000 ms from then
// on. n is reset to 10 ms if a message is actually received.
function poll() {
  var msgs;
  var pollWaitDelay = (function() {
    var delay = 10, counter = 1;

    function reset() {
      delay = 10;
      counter = 1;
    }

    function increase() {
      counter += 1;
      if (counter > 20) {
        delay = 1000;
      } else if (counter > 10) {
        delay = 100;
      }                          // else leave delay at 10
    }

    function value() {
      return delay;
    }

    return {reset: reset, increase: increase, value: value};
  }());

  // getLoop is defined and used immediately here.  It retrieves
  // messages from the server and then schedules itself to run
  // again after pollWaitDelay.value() milliseconds.
  (function getLoop() {
    get(function (response) {
      var i, msgs = (response && response.msgs) || [];

      // if messages property exists, then we are connected   
      if (response.msgs && (status !== "connected")) {
        // switch status to connected since it is now!
        status = "connected";
        connectedHandler();
      }
      if (msgs.length > 0) {           // we got messages
        pollWaitDelay.reset();
        for (i=0; i<msgs.length; i+=1) {
          handleMessage(msgs[i]);
        }
      } else {                         // didn't get any messages
        pollWaitDelay.increase();
      }

      // now set timer to check again
      setTimeout(getLoop, pollWaitDelay.value());
    });
  }());
} //End poll()



// This function is part of the polling setup to check for
// messages from the other browser.  It is called by getLoop()
// inside poll().
function get(getResponseHandler) {

  // response should either be error or a JSON object.  If the
  // latter, send it to the user-provided handler.
  function handler() {
    if(this.readyState == this.DONE) {
      if(this.status == 200 && this.response != null) {
        var res = JSON.parse(this.response);
        if (res.err) {
          getResponseHandler("error:  " + res.err);
          return;
        }
        getResponseHandler(res);
        return res;
      } else {
        getResponseHandler("HTTP error:  " + this.status);
        return;
      }
    }
  }

  // open XHR and request messages for my id
  var client = new XMLHttpRequest();
  client.onreadystatechange = handler;
  client.open("POST", "https://signal.seshi.io/get");
  client.send(JSON.stringify({"id":id}));
}


// Schedule incoming messages for asynchronous handling.
// This is used by getLoop() in poll().
function handleMessage(msg) {   // process message asynchronously
  setTimeout(function () {messageHandler(msg);}, 0);
}


// Send a message to the other browser on the signaling channel
function send(msg, responseHandler) {
  var reponseHandler = responseHandler || function() {};

  // parse response and send to handler
  function handler() {
    if(this.readyState == this.DONE) {
      if(this.status == 200 && this.response != null) {
        var res = JSON.parse(this.response);
        if (res.err) {
          responseHandler("error:  " + res.err);
          return;
        }
        responseHandler(res);
        return;
      } else {
        responseHandler("HTTP error:  " + this.status);
        return;
      }
    }
  }

  // open XHR and send my id and message as JSON string
  var client = new XMLHttpRequest();
  client.onreadystatechange = handler;
  client.open("POST", "https://signal.seshi.io/send");
  var sendData = {"id":id, "message":msg};
  client.send(JSON.stringify(sendData));
}


return {
  connect:  connect,
  send:  send
};

};


function connectedStatus(){
	if ( typeof dc=== 'undefined' || dc === null || dc.readyState !== 'open') {
		console.log("No yet connected.");
	} else if (dc.readyState === 'open') {
		console.log("We are connected.");
	}
}

window.onload = function () { 

/*********************************************************************/

function isPlayable(fileName) {
	/* Mp3 */
	fileName = fileName.toLowerCase();
	if (fileName.indexOf('.mp3') > -1) {
		return true;
	}
	/* Mp4 */
	if (fileName.indexOf('.mp4') > -1) {
		return true;
	}
	/* webm */
	if (fileName.indexOf('.webm') > -1) {
		return true;
	}
	
	/* ogg */
	if (fileName.indexOf('.ogg') > -1) {
		return true;
	}

	/* ### Images ### */
	
	/* jpg */
	        if (fileName.indexOf('.jpg') > -1) {
                return false;
        }
	
	/* jpeg */
	        if (fileName.indexOf('.jpeg') > -1) {
                return false;
        }
	
	/* png */
	        if (fileName.indexOf('.png') > -1) {
                return false;
        }

	/* ### Documents ### */

	/* pdf */
	        if (fileName.indexOf('.pdf') > -1) {
                return false;
        }
	
	// Presume playable 
	return true
} //End isPlayable()

function isImage(fileName) {

	/* MY FIDDLE: http://jsfiddle.net/fua75hpv/80/ */

	/* jpg */
	        if (fileName.indexOf('.jpg') > -1) {
                return true;
        }
	
	/* jpeg */
	        if (fileName.indexOf('.jpeg') > -1) {
                return true;
        }
	
	/* png */
	        if (fileName.indexOf('.png') > -1) {
                return true;
        }

	return false;
}//End isImage(fileName)

};


processRecieveBufferFLAG = false;
Seshi = {
    welcome:(function(){   /*
                        #   Seshi Init
                        #   - Display welcome message -
                        */
                        var welcomeMsg = "🚀  Welcome to Seshi! 🚀\n\nLet's rock the boat...\n\n\nType Seshi.help() for help.. \n\n\n";
                        console.log(welcomeMsg);
                        return welcomeMsg;
                    })(),
    config:{
        "SeshiBotOn":false,
        "YoloInitMsg":false
    },
    init:function(){
                        /* Initialise Seshi
                         *
                         * > Create all Seshi.events
                         * > Checks for existing Signaling Servers, adds Seshi.io as default
                         * > Updates local file list cache
                        */

                        //Create & register Seshi spesific events
                        // - Custom Events triggered by Seshi useful to front-end UI development
                        // - The events are fired (dispatched) according to their individual case.

                        //Fired when a datachannel is established between both peers
                        onPeerConnectionEstablished = new Event('onPeerConnectionEstablished');
                        onPeerConnectionEstablished.initEvent('onPeerConnectionEstablished', true, true);

                        //Fired when a datachannel is BROKEN between both peers
                        onPeerConnectionBroken = new Event('onPeerConnectionBroken');
                        onPeerConnectionBroken.initEvent('onPeerConnectionBroken', true, true);

                        //Fired when the datachannel recieves a file listing from their connected peer
                        gotRemoteFileList = new Event('gotRemoteFileList');
                        gotRemoteFileList.initEvent('gotRemoteFileList', true, true);

                        //Fired when a new chat message is recived
                        onNewChatMessage = new Event('onNewChatMessage');
                        onNewChatMessage.initEvent('onNewChatMessage', true, true);

                        //Fired when the storage worker reports it has stored from more chunks of a file(s)
                        storeFilesProgressUpdate = new Event('storeFilesProgressUpdate');
                        storeFilesProgressUpdate.initEvent('storeFilesProgressUpdate', true, true);

                        //Fired when sending file progress update occurs (sending chunk-by-chunk over datachannel)
                        sendFileProgressUpdate = new Event('sendFileProgressUpdate');
                        sendFileProgressUpdate.initEvent('sendFileProgressUpdate', true, true);

                        //Fired when we have recived the display name of the connected device
                        onGotRemoteDisplayName = new Event('onGotRemoteDisplayName');
                        onGotRemoteDisplayName.initEvent('onGotRemoteDisplayName', true, true);

                        //Fired when a playInSync request is recieved, fileId is dispatched to UI
                        onPlayInSyncRequest = new Event('onPlayInSyncRequest');
                        onPlayInSyncRequest.initEvent('onPlayInSyncRequest', true, true);

                        //Fired from UI when play event happends <--- NOTE: from UI, a user generated action.
                        SeshiSkinPlay = new Event('SeshiSkinPlay');
                        SeshiSkinPlay.initEvent('SeshiSkinPlay', true, true);

                        //Fired from UI when pause event hapends <--- NOTE: from UI, a user generated action.
                        SeshiSkinPause = new Event('SeshiSkinPause');
                        SeshiSkinPause.initEvent('SeshiSkinPause', true, true);

                        //Fired when a pause request is received (e.g. from remote peer)
                        onSeshiPauseReq = new Event('onSeshiPauseReq');
                        onSeshiPauseReq.initEvent('onSeshiPauseReq', true, true);

                        //Listen for SeshiSkinPlay event (dispatched from the UI)
                        window.addEventListener('SeshiSkinPlay', Seshi.playHandler, false);

                        //Listen for SeshiSkinPause event (dispatched from the UI)
                        window.addEventListener('SeshiSkinPause', Seshi.pauseHandler, false);

                        //Initalize storage worker
                        StorageWorker = new Worker("js/workers/storeFileDexieWorker.js");
                        //Recieve proress message(s)
                        StorageWorker.onmessage = function(event) {
                            var progressData = event.data;
                            //Update Seshi.storeProgess array with file storing progress updates, indexeded by fileId

                            if ( Seshi.storeProgress[progressData.fileId] === undefined ) 
                            {
                                currentChunk = 0;
                            }else { //End set progress to zero initially
                                currentChunk = Seshi.storeProgress[progressData.fileId].currentChunk;
                            }//End else incriment currentChunk using current value
                                 
                            Seshi.storeProgress[progressData.fileId] = {
                                "fileName":progressData.fileName,
                                "currentChunk":currentChunk + 1,
                                "totalNumChunks":progressData.totalNumChunks,
                                "complete":currentChunk >= progressData.totalNumChunks ? true:false,
                                "UIdone":false
                                }
                            dispatchEvent(storeFilesProgressUpdate);//Dispacht/fire progress update event for local UI

                            //Delete completed storeProgess
                            if(Seshi.storeProgress[progressData.fileId].complete == true)
                            {
                                delete(Seshi.storeProgress[progressData.fileId]);
                            }
                        }//End recieve storage progress update and update Seshi.storeProgress array with fileId's progress

                        //Initalize local files list cache if empty
                        if (!localStorage.getItem("localFilesList" || localStorage.getItem('localFilesList').length == 0)) {
                            Seshi.updateLocalFilesList();
                        }//Load localFilesList if empty
                        //Populate signaling servers list (Seshi.signalingServers.list)
                        Seshi.signalingServers.buildList();

                        //Add default Seshi.io Signaling server if none present
                        if ( Seshi.signalingServers.list.length == 0 ) {
                            Seshi.addSignalingServer("seshi.io");
                        }//End add default signaling server if none present
                        return "It's 106 miles to Chicago; We got a full tank of gas; half a pack of cigarettes; its dark, and we're wearing sunglasses. Let's go!";
    },
    help:function(){console.log("#\n" +
                        '# Usage:\n' +
                        '#  Seshi.help() -- This menu\n' +
                        '#  Seshi.connectionStatus -- Returns object of peer connection state for iceConnectionState & dataChannelState\n'+
                        '#  Seshi.generateKey() -- Returns a key (string) to be used when setting up a peer connection. This getts passed to the signalingServer.\n' +
                        '#  Seshi.store({\'dataSource\':\'fileSystem || seshiChunk\',\'data\':this.files}) -- Store data into Seshi\'s Database\n' +
                        '#  Seshi.storeProgress -- Arrary indexed by fileId shows store progress e.g. for (var key in Seshi.storeProgress){Seshi.storeProgress[key];}\n'+
                        '#  Seshi.updateLocalFilesList() -- Refreshes the local file list\n' +
                        '#  Seshi.deleteFile(fileId) -- Delete file from Seshi\n' +
                        '#  Seshi.localFileList() -- Returns list of local files in Array of JSON objects\n' +
                        '#  Seshi.play(fileId, element) -- Playback a file (fileId) in your browser, attaching it as the src of (element) video or audio tag\n' +
                        '#  Seshi.sendLocalFileListToRemote -- Send local filelist to peer. Peer automatically sends theirs back populating Seshi.remoteFileList\n' +
                        '#  Seshi.download() -- Download a given fileId to the users local filesystem.\n' +
                        '#  Seshi.remoteFileList  -- Returns list of connected peers files (when connected)\n' +
                        '#  Seshi.sendFileToPeer(fileId) -- Send a file to peer over DataChannel. Must specify local FileId\n' +
                        '#  Seshi.setBoxId(boxName) -- Set Seshi.boxId , (similar to the folder concept, but more just a name to refer to a collection of files.\n' +
                        '#  Seshi.getBoxId() -- Returns the current Seshi.boxId name under which files will be stored.\n' +
                        '#  Seshi.syncData() -- Send all data to connecteed peer. This may take a while!\n' +
                        '#  Seshi.addSignalingServer("example.com")  -- Add the address of additional signaling server(s)\n' +
                        '#\n\n\n' +
                        '#  ## The rest if Seshi is still being wrapped into the `Seshi.<call>` api ##\n' +
                        '#  ## for better code quality and to help make building user interfaces a much cleaner experience. ##\n' +
                        '#      These will probably be named:\n' +
                        '#          > Seshi.call() -- For contacting signaling server(s)\n' +
                        '#          > Seshi.connect() -- Establish connection between peers\n' +
                        '#          > Seshi.play() -- Returns blob url of file so UI can playback media. (see: https://goo.gl/mmPU9V)\n'
            ); return "🚀 🚀  Keep calm & Seshi on! 🚀 🚀"},
    connect: function() {
                        /* Connect()
                         *
                         * Calls index.js Connect
                         * Crude call to older code..
                         *
                         * Connect() is used to establish the signalling channel.
                         * Once established, call() can be executed to begin a datachannel connection.
                         */
                        connect();
    },
    connectionStatus:{
                        iceConnectionState:function(){
                            if (typeof pc == "undefined") {
                                return "Not Started. Use Seshi.connect() to begin a peer connection";
                            } else {
                                return pc.iceConnectionState}
                        },
                        dataChannelState:function(){
                            if (typeof dc == "undefined") {
                                return "Not Started. Use Seshi.call() after initiating peer connection with Seshi.connect()";
                            } else {
                                return dc.readyState }
                        }

    },
    signalingStatus:'',
    getSignalingStatus: function() {
                        /* getSignalingStatus
                        * Simply return current status of signaling connection
                        */
                        return Seshi.signalingStatus;
    },
    setSignalingStatus: function(statusMsg) {
                        /* setSignalingStatus()
                         * Set signalling status (upon a change in signaling) */
                        Seshi.signalingStatus = statusMsg;
    },
    key:'', //Connection key for two connecting peers
    setKey: function() {
                        /* Generate connection key
                         * Used as key to pass to signaling server for connecting two peers
                        */
                        var array = new Uint32Array(1);
                        window.crypto.getRandomValues(array);
                        Seshi.key = array[0];
                        //Store key in localstorage (so can be used to prevent self connects)
                        localStorage.setItem('key', Seshi.getKey());
                        //Return key
                        return Seshi.getKey();
    },
    getKey: function() {
                        /* getKey()
                         * - Returns the current connection key
                         */
                        return Seshi.key;
    },
    getShareUrl: function() {
                        /* getShareURL
                         * - Returns the share url that the user needs to send to
                         *   their friend / other device
                         */
                        var shareUrl =  document.location.origin + '?key=' + Seshi.getKey() + '#fileBoxes';
                        return shareUrl;
    },
    setDisplayName: function(name) {
                        /* setDisplayName(name)
                         *
                         * - Set device / user display name
                         *   Used in chat window & to distinguish devices/users
                         */
                         //Set display name in local storage
                         localStorage.setItem("displayName", name);
                         trace("Set display name to: " + Seshi.getDisplayName());
    },
    getDisplayName: function() {
                        /* getDisplayName()
                         *
                         * - Returns the local peers display name
                         *   returns empty string if not set.
                         */
                         if(!localStorage.getItem("displayName")){
                            return ''; //Display name is not set
                         } else {
                            return localStorage.getItem("displayName")
                         }
    },
    sendLocalDisplayName:function() {
                        /* sendLocalDisplayName()
                         *
                         * - Send local display name to remote peer
                         *   over datachannel as SeshiBot message
                         */
                         //Build sendLocalDisplayName message
                         var displayNameMsg = {
                             'cmd':'remoteDisplayName',
                             'remoteDisplayName':Seshi.getDisplayName()
                         };

                         //Send over datachannel
                         displayNameMsg = JSON.stringify(displayNameMsg);
                         dc.send(displayNameMsg);
    },
    setRemoteDisplayName: function(msg) {
                        /* setRemoteDisplayName()
                         *
                         * - Receive remote peers display name from
                         *   over datachannel in form of SeshiBot message
                         */
                         //Store in localstorage ofr persistance
                         localStorage.setItem('remoteDisplayName', msg.remoteDisplayName);
                         //Fire event to let UI layer no we've got remotes' display name
                         dispatchEvent(onGotRemoteDisplayName);
    },
    getRemoteDisplayName: function() {
                          /* getRemoteDisplayName()
                           *
                           * - Returns the remote users display name (if set)
                           *   returns empty string if not set
                           */
                          if (!localStorage.getItem('remoteDisplayName')) {
                                return '';
                          } else {
                                return localStorage.getItem('remoteDisplayName');
                          }
    },
    updateLocalFilesList: function() {
                        /*
                        #   UpdateLocalFilesList()
                        #   - Refreshes Seshi's list of local files cache -
                        #
                        #   Calls a worker, defined in js/getLocalFilesList.js
                        #   The worker queries IndexedDB for the latest list of files.
                        #   This takes time (hence the cache)
                        #   When done, the worker posts a message back to Seshi
                        #   containing the most up-to-date list of files as an array
                        #   of objects. Seshi updates it's 'cache' of the latest file
                        #   list by Appending the list to Seshi.getLocalFileList.
                        */
                        var promise = new Promise (function(resolve, reject) {
                            var LocalFilesListWorker= new Worker('js/workers/getLocalFilesList.js');
                            LocalFilesListWorker.postMessage({'cmd':'listFilesMeHearty'});
                            //Act of response from worker (the list of files)
                            LocalFilesListWorker.onmessage = function(event) {
                                console.log("Updating list of local files. Type: Seshi.localFileList for updated list");
                                resolve(localStorage.setItem("localFilesList", JSON.stringify(event.data.fileList)));
                            }
                        });
                            return promise;
                       },
    deleteFile:function(fileId){
                        /* Delete File From Seshi database given fileId */
                      db.chunks.where("fileId").equals(fileId).delete()
                      .then(function(deleteCount) {
                        console.log("Deleted: " + deleteCount + " chunks. Of fileId: " + fileId );
                        Seshi.updateLocalFilesList(); //Update local filelist cache
                      });
    },
    localFileList:function() {
                        /* Returns cached local files list from localstorage as array of JSON objects */
                        return JSON.parse(localStorage.getItem('localFilesList'));
                        },
    remoteFileList:[]   /* Returns cached list of remote peer's files as an array of JSON objects */,
    recvRemoteFileList:function(remoteFileList) {
        console.log("Received list of files from connected peer.");
        //Attach remote peers file listing to Seshi.remoteFileList object
        Seshi.remoteFileList = JSON.parse(remoteFileList.data);
        //Dispatch event telling any UI there's a (potentially) updated file listing from their peer
        dispatchEvent(gotRemoteFileList);
        msgRemoteFileList = JSON.stringify({'chat':'Sucesfully recived your list of files, ta!\nSending mine now..',
                                            'remoteDisplayName':'SeshiBOT'
                                            });
        if (Seshi.config.SeshiBotOn)
            {
                dc.send(msgRemoteFileList);
            }//End send Seshi Bot message about file list if SeshiBotIs On
        if (!remoteFileList.reply)
        {
            console.log("Replying back to peer with own local file listing...");
            Seshi.sendLocalFileListToRemote(reply=true);//Send own localFilesList back to remote peer that sent theirs
        }//End send back own local files list if havn't already sent it
    },
    store:function(dataSourceMsg) {
                        /* Store() data into Seshi's Indexed DB
                         #
                         # 'dataSourceMsg' should be given in the following format:
                         #
                         #  {
                         #      "dataSource":"fileSystem || seshiChunk",
                         #      "data":"File object || Seshi ArrayBuffer packet
                         #  }
                         #
                         #  If dataSource is 'fileSystem' then 'data' should be a File
                         #  list object (https://developer.mozilla.org/en/docs/Web/API/FileList)
                         #  each file in the file list object will then be chunked & stored
                         #  into Seshi's IndexedDB using the web worker storeFileDexieWorker.js
                         #
                         #  If dataSource is 'seshiChunk', it should be a Seshi chunk of type
                         #  arrayBuffer. Each chunk will be stored directly into Seshi's
                         #  IndexedDB using the web worker storeFileDexieWorker.js
                        */
                        console.log("In store..");
                        StorageWorker.postMessage(dataSourceMsg); // Post data to worker for storage
    },
    storeProgress:[],
    sendLocalFileListToRemote:function(bool) {
        console.log("Should send my file list now over datachannel to peer..");
        //Send most up to date file listing or cached version?? hmm.
        //Prepare file list message to send to remote peer
        localFileList = JSON.stringify(Seshi.localFileList());
        msgSendLocalFileList = {"cmd":"recvRemoteFileList", "data":localFileList, "reply":bool};
        msgSendLocalFileList = JSON.stringify(msgSendLocalFileList);
        dc.send(msgSendLocalFileList);

        //Also send along local display name so user has some vauge idea who they might be connected to
        Seshi.sendLocalDisplayName();
    },
    generateObjectUrl:function(fileId) {
                        /* generatObjectUrl(fileId)
                         *
                         * - Generate a blob url for a given fileId
                         * Returns promise, which when resolved returns
                         * an object:
                         *  {
                         *      objectURL: 'blob url of object',
                         *      mimetype:  'mp3/example'
                         *  }
                        */
                        var promise = new Promise (function(resolve, reject) {
                            //Query IndexedDB to get the file
                            db.transaction('r', db.chunks, function() {
                                //Transaction scope
                                db.chunks.where("fileId").equals(fileId).toArray(function(chunks) {
                                            console.log("Found " + chunks.length + " chunks");
                                            var allChunksArray = [];
                                            //Just get blob cunks (without meta info)
                                            for(var i=0;i<chunks.length; i++){
                                                allChunksArray[i] = chunks[i].chunk
                                            }//End put all chunks into all chunks array
                                            var file = new Blob(allChunksArray, {type:chunks[0].fileType});
                                            var fileName = chunks[0].fileName;
                                            console.log(chunks[0].fileType);
                                            url = window.URL.createObjectURL(file);
                                            console.log("Data: " + url);
                                            resolve(
                                                {   objectURL:url, //A blob url
                                                    fileName: fileName,
                                                    mimeType: chunks[0].fileType //e.g. audio/ogg
                                                }); //Resolve promise
                                        })//Assemble all chunks into array
                                        //Simply download file if on mobiles
                                }).catch (function (err) {
                                    console.error(err);
                                })//End get file chunks from fileId and generate object url.
                        });//End promise
                        return promise;
    },
    play:function(fileId, playerId) {
                        /* Playback requested fileId to user
                         * - Updates video or audio `src` attribute of playerId and starts playback -
                         * TODO move Seshi.play to a streaming web worker!
                        */
                        //Query IndexedDB to get the file
                        db.transaction('r', db.chunks, function() {
                            //Transaction scope
                            db.chunks.where("fileId").equals(fileId.fileId).toArray(function(chunks) {
                                    console.log("Found " + chunks.length + " chunks");
                                    var allChunksArray = [];
                                    //Just get blob cunks (without meta info)
                                    for(var i=0;i<chunks.length; i++){
                                        allChunksArray[i] = chunks[i].chunk
                                    }//End put all chunks into all chunks array
                                    var file = new Blob(allChunksArray, {type:chunks[0].fileType});
                                    console.log(chunks[0].fileType);
                                    url = window.URL.createObjectURL(file);
                                    console.log("Data: " + url);
                                    var video = document.getElementById(playerId);
                                    var obj_url = window.URL.createObjectURL(file);
                                    video.src = obj_url;
                                    video.addEventListener('canplay', function() {
                                        if ( video.readyState == 4 ) {
                                            video.play();
                                        }
                                    })//End playback media when ready
                            }).catch (function (err) {
                                console.error(err);
                            })});//End get file chunks from fileId and playback
    },
    pause:function() {
                        /* Seshi.pause()
                         * - Fire pause event informing SeshiSkin to pause 
                         *   whatever it's playing.
                         */
                         dispatchEvent(onSeshiPauseReq);
    },
    isPlayable: function(mimeType, fileName) {

                               if(mimeType.includes('audio') || mimeType.includes('video'))
                                {
                                    return true;
                                }

                               switch(mimeType) {
                                    case 'audio/mp3':
                                    case 'audio/ogg':
                                    case 'audio/wave':
                                    case 'audio/webm':
                                    case 'audio/wav':
                                    case 'audio/x-wav':
                                    case 'audio/x-pn-wav':
                                    case 'audio/x-aac':
                                    case 'audio/midi':
                                    case 'video/mp4':
                                    case 'video/ogg':
                                    case 'video/3gpp':
                                    case 'video/quicktime':
                                    case 'video/webm':
                                    case 'video/mpeg':
                                    case 'video/x-flv':
                                    case 'video/x-msvideo':
                                    case 'application/ogg':
                                         return true;
                                }//End check mimetype

                               // Check type using filename (last resort)
                               if(fileName) {
                                    fileName = fileName.toLowerCase();
                                    /* Mp3 */
                                    if (fileName.indexOf('.mp3') > -1) {
                                        return true;
                                    }
                                    /* Mp4 */
                                    if (fileName.indexOf('.mp4') > -1) {
                                        return true;
                                    }
                                    /* webm */
                                    if (fileName.indexOf('.webm') > -1) {
                                        return true;
                                    }

                               }//End check type using filename (last resort)

                               return false;
    },
    playInSyncRequest:function(fileId) {

                            var msg = {
                                "cmd":"playInSyncRPC", 
                                "request": "playRequest",
                                "fileId":fileId
                            };

                            msg = JSON.stringify(msg);
                            //Send request of datachannel
                            dc.send(msg);
                            //Fire Play on local peer event
                            var event = new CustomEvent(
                                    "playRequest",
                                    {
                                        detail: {
                                            "fileId":fileId
                                        },
                                        bubbles: true,
                                        cancelable: true
                                    } 
                            );//End create play request event
                            dispatchEvent(event);

                            //Seshi.play({'fileId':fileId}, "video");
    },
    playInSyncRPC:function(msg) {
                            /* playInSync()
                             * - RPC Handler for playing media in sync
                             *
                             *   Impliments: 
                             *   - Play in sync (both peers begin playing same local file)
                             *   - Pause in sync
                             */
                             
                             //determine rpc call
                             switch(msg.request) {
                                
                                 case 'playRequest':
                                     playFile(msg.fileId);
                                     break;
                                 case 'pause':
                                     Seshi.pause();
                                     break;
                                 case 'play':
                                     //Note: The var fileId is in global scope (cringe) from origional play in sync request.
                                     resumePlayFile(fileId); //This is more a resume than a play...
                                     break;
                             }//End determine rpc call
                            
                            function playFile(fileId)
                            {
                                //Don't play if it's the same file as last time  (avoid plyr/me bug)
                                if ( fileId == localStorage.getItem('currentlyPlaying')) {
                                    var player = document.querySelector('.plyr');
                                    player.plyr.play()
                                    return;
                                }
                             
                                //Play file
                                //Fire Play on local peer event
                                var event = new CustomEvent(
                                        "playRequest",
                                        {
                                            detail: {
                                                "fileId":fileId
                                            },
                                            bubbles: true,
                                            cancelable: true
                                        }
                                );//End create play request event
                                dispatchEvent(event);
                            }//End playFile(fileId);

                            function resumePlayFile(fileId)
                            {
                                //Resume Play file
                                var event = new CustomEvent(
                                        "resumePlayRequest",
                                        {
                                            detail: {
                                                "fileId":fileId
                                            },
                                            bubbles: true,
                                            cancelable: true
                                        }
                                );//End resume play request event
                                dispatchEvent(event);
                            }//End resumePlayFile(fileId);
    },
    playHandler: function() {
                            /* playHandler()
                             *  - This is more an UN-pause handler than a playHandler TODO (RENAME??)
                             *  - React to play even fired by UI to unpause mendia
                             */
                            console.log("In Seshi.playHandler");

                            //If playing in sync, tell other peer to lay  TODO: FLAG NEEDED
                            var msg = {
                                        "cmd":"playInSyncRPC",
                                        "request":"play"
                                };

                            //Stringify 
                            msg = JSON.stringify(msg);
                            //Send play request to peer TODO: Check peer connection first
                            dc.send(msg);
    },
    pauseHandler: function() {
                            /* pauseHandler() 
                             * - react to pause event fired by UI
                             */
                            trace("In Seshi.pauseHandler");

                            //If playing in sync, tell other peer to pause TODO: FLAG NEEDED
                            var msg = {
                                        "cmd":"playInSyncRPC",
                                        "request":"pause"
                                };
                            //Stringify 
                            msg = JSON.stringify(msg);
                            //Send pause request to peer TODO: Check peer connection first
                            dc.send(msg);
    },
    download:function(fileId) {
                        /* Download
                        * - Download a given fileId from Seshi's database to the system's filesystem boo.
                        * TODO move Seshi.download job to a web worker!
                        */
                        //Query IndexedDB to get the file
                        db.transaction('r', db.chunks, function() {
                            db.chunks.where("fileId").equals(fileId).toArray(function(chunks) {
                                console.log("Found " + chunks.length + " chunks");
                                var allChunksArray = [];
                                //Just get blob cunks without meta
                                for(var i=0;i<chunks.length; i++){
                                    allChunksArray[i] = chunks[i].chunk
                                }//End put all chunks into all chunks array
                                //Build file blob out of chunks and send to users browser for download.
                                var file = new Blob(allChunksArray, {type:chunks[0].fileType});
                                console.log(chunks[0].fileType);
                                url = window.URL.createObjectURL(file);
                                console.log("Data: " + url);
                                var a = document.createElement("a");
                                document.body.appendChild(a);
                                a.style = "display: none";
                                a.href = url;
                                a.download = chunks[0].fileName;
                                a.click();
                            })//End db.chunks toArray using Dexie (.then follows)
                        }).then(function() {
                            //Transaction completed
                        }).catch (function (err) {
                            console.error(err);
                        });//End get fildIdChunks from fileId
    },
    sendFileToPeer:function(fileId) {
                        /* Sends given file (fieId) over Datachannel to connected peer
                         * For each chunk found, send over data channel until 'last chunk'* has been sent.
                         * The following comments require multipeer (TODO)
                         *  > *Not all peers will have all chunks to the file, some may only have a subset.
                         *  > Close the connection? no.
                         *  > Exchange useful data:
                         *      Share known signaling servers, peer exchange, file lists (names), boxIds
                        */

                        //Set flag for outbox
                        Seshi.flagProcessOutboxStarted = true;
                        //Check Datachannel connection status
                        if (typeof dc == "undefined" || dc.readyState != "open") {
                            console.error("Seshi.sendFileToPeer(fileId) Tried to send file to peer but Datachannel is not open");
                            return false;
                        }//End check Datachannel is actually open

                        db.transaction('r', db.chunks, function() {
                            db.chunks.where("fileId").equals(fileId).each(function(chunk) {
                            //Transaction scope
                            //Sending file meta...
                            var meta = {"fileId":chunk.fileId, "chunkNumber":chunk.chunkNumber, "chunkSize":chunk.chunkSize, "numberOfChunks":chunk.numberOfChunks,"fileType":chunk.fileType,"fileName":chunk.fileName};
                            var lengthOfMeta = JSON.stringify(meta).length;
                            lengthOfMeta = zeroFill(lengthOfMeta, 64);
                            var metaLength = {"metaLength":lengthOfMeta}; //Always 81 characters when stringified
                            var header = JSON.stringify(metaLength) + JSON.stringify(meta);
                            var sendChunk = new Blob([header, chunk.chunk]);
                            //Add chunk to outBox for sending
                            Seshi.outBox.push({
                                percentComplete: (chunk.chunkNumber + 1) / chunk.numberOfChunks * 100,
                                fileName: chunk.fileName,
                                fileId: chunk.fileId,
                                fileType: chunk.fileType,
                                chunkNumber: chunk.chunkNumber,
                                numberOfChunks: chunk.numberOfChunks,
                                chunk: sendChunk
                            });
                            Seshi.processOutbox();
                            //Close outbox flag so we don't repeatedly open a new filereader
                            Seshi.flagProcessOutboxStarted=false;

                            }).then(function(){
                            Seshi.flagProcessOutboxStarted = true;
                            Seshi.processOutbox();
                            })});
    },
    outBox:[],
    flagProcessOutboxStarted:true,
    processOutbox:function() {
                    /* processOutbox()
                     *
                     * - Reads outbox & sends each message to peer untill outBox is empty.
                     */
                    if ( Seshi.flagProcessOutboxStarted == true && typeof fr != 'object')
                    {
                        fr = new FileReader

                        function loadNext() {

                        fr.onload = function(chunk) {
                              if (Seshi.outBox.length >= 0) {
                                //Add chunk to buffer
                                Seshi.buffer.push(chunk.target.result);
                                Seshi.sendAllData(); //Send arrayBuffer chunks out over datachannel with buffering
                                    //Kill off fileReader if we've reached the end
                                    if(Seshi.outBox.length == 0)
                                    {
                                        fr = undefined;
                                    }//End kill off fileReader if we've reached the end
                                loadNext(); // shortcut here
                              }
                           };
                        chunkData = Seshi.outBox.pop();
                        fr.readAsArrayBuffer(chunkData.chunk);
                        }

                        loadNext();
                    }//End only open reader again if flagProcessOutboxStarted is set to true.
    },
    updateSendingProgress: function(ack) {
                    /* This is called by receivedChunkACK comman from over the datachannel.
                     * This occurs when the connected peer has sucessfully received, and stored
                     * A chunk which we sent to them. the 'receivedChunkACK' is their confirmation
                     * which we then use to update the sender on the progress of their push. 
                     * (A push is a file 'upload' to a connected peer).
                     * */
                    //For file progress, just count number of ACKS received, not the actual 
                    // chunk number in the ACK message, because chunks mayt arrive out of order
                    // therere ack.chunkNumber is not a reliable indicator of chunk recieved progress

                    if ( Seshi.sendingFileProgress[ack.fileId] === undefined )
                    {
                        recvChunkCount = 0;
                    }else { //End set progress to zero initially
                        recvChunkCount = Seshi.sendingFileProgress[ack.fileId].recvChunkCount;
                    }//End else incriment currentChunk using current value

                    Seshi.sendingFileProgress[ack.fileId] = {
                        "percentComplete"   : (ack.chunkNumber + 1) / ack.numberOfChunks * 100,
                        "fileName"          : ack.fileName,
                        "fileId"            : ack.fileId,
                        "fileType"          : ack.fileType,
                        "chunkNumber"       : ack.chunkNumber,
                        "numberOfChunks"    : ack.numberOfChunks,
                        "recvChunkCount"    : recvChunkCount + 1,
                        "complete"          : recvChunkCount >= ack.numberOfChunks ? true:false,
                        "UIdone"            : false
                    }//End update Seshi.sendingFileProgress[]

                    //Fire sendFileProgressUpdate event so sender knows to update their UI with sending progress bar
                    dispatchEvent(sendFileProgressUpdate);
                    //Delete completed storeProgess
                    if(Seshi.sendingFileProgess[ack.fileId].complete == true)
                    {
                        delete(Seshi.sendingFileProgress[ack.fileId]);
                    }

    },
    bufferFullThreshold:4096,
    listener: function() {
                dc.removeEventListener('bufferedamountlow', Seshi.listener);
                Seshi.sendAllData();
    },
    sendAllData: function() {
        while (Seshi.buffer.length > 0) {
                if(dc.bufferedAmount > Seshi.bufferFullThreshold) {
                    //Use polling (forced)
                    //setTimeout(Seshi.sendAllData, 106500);
                    dc.addEventListener('bufferedamountlow', Seshi.listener);
                    return; //Exit sendAllData  until ready because buffer is full
                }//End wait for buffer to clear (dc.bufferedAmount > bufferFullThreshold)
                dc.send(Seshi.buffer.shift());
        }//End while buffer is not empty
    },
    buffer:[], 
    recvBuffer:[],
    sendingFileProgress:[],
    addSignalingServer:function(signallingServerAddress){
                            /* - Add a signaling server to Seshi - */
                            //Check dosen't already exist
                            signalServerDb.signalServers.where("address").equalsIgnoreCase("seshi.io").
                                count(function(num){
                                    if (num == 0) {//If entry dosn't already exist, add to indexedDB
                                        signalServerDb.signalServers.add({address: signallingServerAddress,
                                        lastSuccessfulConnectTimestamp: null,
                                        lastConnectAttempTimestamp: null,
                                        numFailedConnectAttempts: null}).
                                        then(function(){
                                        console.log('Successfully Inserted signaling server "' + signallingServerAddress + '"');
                                        }).catch(function(error) {
                                        console.error(error);
                                        });//End insert new singalingServerAddress
                                    }
                                })
    },
    signalingServers:{
            list:[],
            buildList:function(){
                    signalServerDb.transaction('r', signalServerDb.signalServers, function()

                    {signalServerDb.signalServers.each(function(signalServer) {
                            Seshi.signalingServers.list.push(signalServer);
                        })
                    })
                }
    },
    requestFilesFromPeer:function(filesRequested) {
                            /* requestFilesFromPeer(filesRequested)
                             *
                             * - Request files from peer (we can see them in
                             *   Seshi.remoteFileList, now we want to request to
                             *   pull them from our peer to our own device!
                             *
                             * Requires datachannel to be open!
                             *
                             * To check dataChannel is open use:
                             * Seshi.connectionStatus.dataChannelState() == 'open'
                             *
                             * Arguments:
                             * `filesRequested` should be an array of
                             *   objects in the following format:
                             * [
                             *  {
                             *      fileId: 'xyz123',
                             *      requestType:'ALL || 'CHUNK' || 'RANGE'
                             *  },
                             *  {
                             *      fileId: 'anotherFileIdExample',
                             *      requestType: 'ALL'
                             *  }
                             * ]
                             *
                             * You can use this to request an entire file from a peer
                             * or TODO a single chunk, or range of chunks.
                             *
                             */

                            //Stringify requested files object
                            var filesRequested = JSON.stringify(filesRequested);
                            //Send command over DataChannel to peer
                            msg = {"cmd":"requestFilesById", "data":filesRequested};
                                   msg = JSON.stringify(msg);
                                           dc.send(msg);
                            //Happy dance we've done a full cirlce & re-implimented a crude FTP in Javascript
                            // go figure!
    },
    sendRequestedFilesToPeer:function(filesRequested){
                            /* sendRequestedFilesToPeer(files)
                             * - Respond to peer request to PULL files from their connected peer
                             *   `filesRequested` is an array of objects containing fileIds and the
                             *   parts of the file that the user is requesting (request type)
                             *
                             *   The request type defaults to send 'ALL' chunks
                             *
                             * TODO requestType can be set to only request certain chunks,
                             * a single chunk, or a range of chunks. This is useful for
                             * a broken download for example, or syncing accross many peers.
                             *
                             * The format of the `filesRequested` argument should be:
                             *
                             * [
                             *  {
                             *      fileId: 'xyz123',
                             *      requestType:'ALL || 'CHUNK' || 'RANGE'
                             *  },
                             *  {
                             *      fileId: 'anotherFileIdExample',
                             *      requestType: 'ALL'
                             *  }
                             * ]
                             */

                            console.log(filesRequested);
                            //Work out what they want
                            var filesRequested = JSON.parse(filesRequested.data);

                            //Loop though each request sending the file to the peer as requested
                            for (var i=0;i<filesRequested.length;i++)
                            {
                                //Work our request type:
                                switch(filesRequested[i].requestType)
                                {
                                    case 'ALL':
                                        Seshi.sendFileToPeer(filesRequested[i].fileId);
                                        break;
                                    case 'CHUNK':
                                        console.log("Request for single chunk..");
                                        break;
                                    case 'RANGE':
                                        console.log("Request for RANGE of chunks..");
                                        break;
                                    default:
                                        Seshi.sendFileToPeer(filesRequested[i]);
                                }//End work our request type (ALL/CHUNK/RANGE) and act accordinly
                            }//End loop through each request sending the file to thhe peer as requested
    },
    syncData:function(){
            /* Send all data to connected peer
             * This is currently very intensive as it does not (yet) make use of the worker
             * TODO ^above^
            */
            db.transaction('r', db.chunks, function() {
                db.chunks.each(function(chunk) {//Transaction scope
                    //Get file meta for chunk header...
                    var meta = {"fileId":chunk.fileId, "chunkNumber":chunk.chunkNumber, "chunkSize":chunk.chunkSize, "numberOfChunks":chunk.numberOfChunks,"fileType":chunk.fileType,"fileName":chunk.fileName};
                    var lengthOfMeta = JSON.stringify(meta).length;
                    lengthOfMeta = zeroFill(lengthOfMeta, 64);
                    var metaLength = {"metaLength":lengthOfMeta}; //Always 81 characters when stringified
                    var header = JSON.stringify(metaLength) + JSON.stringify(meta);
                    var sendChunk = new Blob([header, chunk.chunk]);
                    //Needs to be sent as an arrayBuffer
                    var reader = new FileReader();
                            reader.onload = function(file) {
                            if( reader.readyState == FileReader.DONE ) {
                                    for(var i=0;i<=99999999;i++) {}//Crude delay!
                                    dc.send(result = file.target.result);
                            }//End FileReader.DONE
                    }//End reader.onload
                    reader.readAsArrayBuffer(sendChunk);
                })//End db.chunks toArray using Dexie
            }).then(function() {
                console.log("All chunks (all files) sent to connected peer!");//Transaction completed
            }).catch (function (err) {
                console.error(err);
            });//End log errors from sending all data to peer
},
setBoxId:function(boxName) {
            /* Set boxId
            * A box is similar to the folder concept.
            * Used to organise files stored in Seshi in some fashion
            * e.g. Allow user to store files under a certain box name
            * then query Seshi for files the key path of a given <boxId>
            */
            Seshi.boxId = boxName;
            return "Seshi.boxId is now set to: " + Seshi.boxId;
},
getBoxId:function(){return Seshi.boxId;},
boxId:'myBoxID',//Defaults to myBoxId
trace: function(text) {
            /* trace()
            * logging with timestamp
            */
            if (text[text.length - 1] == '\n') {
                text = text.substring(0, text.length - 1);
            }
            console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}
}//End Seshi :'(

Seshi.init();


///////////////////////////////////////////////////////////////
//
//
//          Index.js
//
//
//////////////////////////////////////////////////////////////

function showDebugInfo() {
        var debugElms = document.getElementsByClassName('debug');
        for ( i=0;i<debugElms.length; i++) {
                debugElms[i].className="debug";
        }
}//End showDebugInfo

var signalingChannel, key, id,
    weWaited = false,
    doNothing = function() {},
    pc, dc, data = {},
    constraints = {},
    fileMeta = {};


// auto-connect signaling channel if key provided in URI
//

if(getQueryVariable("key")) {
    Seshi.key = getQueryVariable("key");
    //Prevent user connecting to themselves
    if (localStorage.getItem('key') != Seshi.key)
    {
        connect();
    }//End prevent user connecting to themselves
}//End auto-connect is key is in URI


function connectedToPeer(e) {
        console.log("Great. Connected to peer via peer signaling channel, probably.");
        setStatus("Connected");
        // set up the RTC Peer Connection since we're connected
}//End

////////////////////////////
// This is the main routine.
////////////////////////////


/////////////////////
// This section is for setting up the signaling channel.
/////////////////////

// This routine connects to the web server and sets up the
// signaling channel.

function connect() {
  var errorCB, scHandlers, handleMsg;

  // First, get the key used to connect
  key = Seshi.getKey();
  // This is the handler for all messages received on the
  // signaling channel.
  handleMsg = function (msg) {
    // First, we clean up the message and post it on-screen
    var msgE = document.getElementById("inmessages");
    var msgString = JSON.stringify(msg).replace(/\\r\\n/g,'\n');
    msgE.value = msgString + "\n" + msgE.value;

    // Then, we take action based on the kind of message
    if (msg.type === "offer") {
      pc.setRemoteDescription(new RTCSessionDescription(msg,
                        function(){console.log("Sucess setRemoteDescription offer on connect()..");},
                        function(){console.log("Failed setRemoteDescription offer on connect()...");}));
      answer();
    } else if (msg.type === "answer") {
      pc.setRemoteDescription(new RTCSessionDescription(msg,
                        function(){console.log("Sucess setRemoteDescription answer on connect..");},
                        function(){console.log("Failed setRemoteDescription answer on connect...");}));
    } else if (msg.type === "candidate") {
      pc.addIceCandidate(
        new RTCIceCandidate({sdpMLineIndex:msg.mlineindex,
                             candidate:msg.candidate}),
                function(){console.log("Add iceCandidate sucess on connect() call..");},
                function(){console.log("error accing iceCanditation on connect() call..");});
    }
  };

  // handlers for signaling channel
  scHandlers = {
    'onWaiting' : function () {
      setStatus("Waiting");
      // weWaited will be used for auto-call
      weWaited = true;
        //Get localDescription ready to send to Peer Signaling server
        //pc.createOffer
        function gotPeerDescription(localSDPOffer) {
                console.log("The Local SDP is: " + localSDPOffer);
        }//End gotPeerDescription(localSDP)
        //pc.createOffer(gotPeerDescription);
    },
    'onConnected': function () {
      setStatus("Connected");
      // set up the RTC Peer Connection since we're connected
      createPC();
    },
    'onMessage': handleMsg
  };

  // Finally, create signaling channel
  signalingChannel = createSignalingChannel(key, scHandlers);
  errorCB = function (msg) {
    document.getElementById("response").innerHTML = msg;
  };

  // and connect.
  signalingChannel.connect(errorCB);
}


// This routine sends a message on the signaling channel, either
// by explicit call or by the user clicking on the Send button.
function send(msg) {
  var handler = function (res) {
    document.getElementById("response").innerHTML = res;
    return;
  },

  // Get message if not passed in
  msg = msg || document.getElementById("message").value;

  // Clean it up and post it on-screen
  msgE = document.getElementById("outmessages");
  var msgString = JSON.stringify(msg).replace(/\\r\\n/g,'\n');
  msgE.value = msgString + "\n" + msgE.value;

  // and send on signaling channel
  signalingChannel.send(msg, handler);
}


//////////////////////////////
// This next section is for setting up the RTC Peer Connection
//////////////////////////////

function createPC() {
  var stunuri = true,
      turnuri = false,
      myfalse = function(v) {
                  return ((v==="0")||(v==="false")||(!v)); },
      config = new Array();
          queryparams = '';

  // adjust config string based on any query params
  if (queryparams) {
    if ('stunuri' in queryparams) {
      stunuri = !myfalse(queryparams['stunuri']);
    }
    if ('turnuri' in queryparams) {
      turnuri = !myfalse(queryparams['turnuri']);
    };
  };

  if (stunuri) {
    // this is one of Google's public STUN servers
    //config.push({"url":"stun:stun.l.google.com:19302"});
    //config.push({"url":"stun:178.62.83.184:3478"});
    config.push({"url":"turn:178.62.83.184:3478","username":"my_username","credential":"my_password"});
  }
  console.log("config = " + JSON.stringify(config));

  window.pc = new RTCPeerConnection({iceServers:config});
  window.pc.onicecandidate = onIceCandidate;
  window.pc.onaddstream = onRemoteStreamAdded;
  window.pc.onremovestream = onRemoteStreamRemoved;
  window.pc.ondatachannel = onDataChannelAdded;
  window.pc.oniceconnectionstatechange = onIceconnectionStateChanged;
  window.pc.onsignalingstatechange = onSignalingStateChanged;
  // wait for local media to be ready
  attachMediaIfReady();
}

// When our browser has another candidate, send it to the peer
function onIceCandidate(e) {
  if (e.candidate) {

        send({type:  'candidate',
                mlineindex:  e.candidate.sdpMLineIndex,
                candidate:  e.candidate.candidate});
        }
}

// When our browser detects that the other side has added the
// media stream, show it on screen
function onRemoteStreamAdded(e) {
  setStatus("On call");
}

// When browser alerts of change to Ice connection state
function onIceconnectionStateChanged(e) {
    console.log("Ice Connection State Change to: " + pc.iceConnectionState);
    if ( pc.iceConnectionState == 'completed' || pc.iceConnectionState == 'connected') {
        //dispatch event onPeerConnectionEstablished since we now have a peer connection (TODO check datachannel state too!)
        dispatchEvent(onPeerConnectionEstablished);
        //Remove key guard from localstorage which prevents users from connecting to themselves
        localStorage.removeItem('key'); 
    }//End if iceConnectionState == Completed

    if (pc.iceConnectionState == 'disconnected') {
        dispatchEvent(onPeerConnectionBroken);
    }//End if iceConnection state is disconnected or failed, dispatch onPeerConnectionEstablished event
}//End onIceconnectionStateChanged

// Yes, we do nothing if the remote side removes the stream.
function onRemoteStreamRemoved(e) {}

//When our browser detects that the other side has added the
//data channel, save it, set up handlers, and send welcome
// message
function onDataChannelAdded(e) {
    //statusE = document.getElementById("status"),
    //statusE.innerHTML = "We are connected!";
    dc = e.channel;
    console.log("We are connected!");
    //sendMostRecentFile();
    setupDataHandlers();
    if ( Seshi.config.YoloInitMsg )
    {
        sendChat("Yolo! Seshi Init.");
    }//Show Seshi init message

    e.channel.onopen = function(){
        //Request file listing from remote peer
        Seshi.sendLocalFileListToRemote();
    }//Once datachannel is open, send over local file listing
}

//When our browser detects a Signaling State Change,
//check to see if it is 'stable'
//if so, execute call() to create a datachannel
function onSignalingStateChanged() {

    console.log("Signaling State Changed to: " + pc.signalingState);

}//End onSignalingStateChanged()


//Set up the datachanner message handler
function setupDataHandlers() {
    data.send = function(msg) {
        msg = JSON.stringify(msg);
        console.log("Sending: " + msg + " over data channel");
        dc.send(msg);
    }
    dc.onmessage = function(event) {
	//statusE = document.getElementById("status"),
	//statusE.innerHTML = "We are connected!";

        //trace('Received Message: ' + event.data);

        if ( event.data instanceof Array ) {
                alert('Is array');
        }

        console.log("We got: " + event.data);

        //Check if message is an array buffer (data)
        if(event.data instanceof ArrayBuffer || event.data.size){ //event.data.size is for Firefox(automatically transforms data to Blob type
            console.log('Recieved ArrayBuffer message');
            //Catch ArrayBuffer sent through the datachannel & add it to recvBuffer for later processing
            Seshi.recvBuffer.push(new Blob([event.data]));

            if ( processRecieveBufferFLAG == false )
            {
                processRecieveBuffer();
            }//Only run processRecieveBuffer() if not already running

        } else { //If not an ArrayBuffer , treat as control packet.
            if(JSON.parse(event.data))
            {
                fileMeta = JSON.parse(event.data);
            }
        }//End determin if data message or control message.



        //Don't JSON.parse is data is already an object ;)
        if ( typeof event.data != "object" ) {
                var msg = JSON.parse(event.data);
        } else {
                var msg = event.data;
        }//End don't parse data message recived if already an object!
        cb = document.getElementById("chatbox");
        rtt = document.getElementById("rtt");


        //Command & control
        //Check for remote calls (ie file listing requests) risky!
        if(msg.cmd) {
            console.log("Interpreting command from remote peer..");
            switch (msg.cmd) {
                case 'sendLocalFileListToRemote': //Request from peer to see filelist
                    Seshi.sendLocalFileListToRemote(); //Local peer sends its local file lsit to remote
                    break;
                case 'recvRemoteFileList': //Receiving list of files from remote peer
                    Seshi.recvRemoteFileList(msg);
                    break;
                case 'receivedChunkACK': //Got a received & stored Chunk ACK from peer.
                    trace("Peer told me that they've sucessfully received & stored a chunk I sent them. Yay."); 
                    Seshi.updateSendingProgress(msg.data);
                    break;
                case 'requestFilesById': //Receiving request from peer to pull files from their peer.
                    Seshi.sendRequestedFilesToPeer(msg);
                    break;
                case 'remoteDisplayName': //Receiving remote's display name
                    Seshi.setRemoteDisplayName(msg);
                    break;
                case 'playInSyncRPC': //Play file in sync with connected peer DUDE.
                    Seshi.playInSyncRPC(msg);
                    break;
            }//Switch on comman requested by remote peer
        }//End check for command & control message from remote peer

        //Realtime chat
        if(msg.rtt) {
        // if real-time-text (per keypress) message, display in
        // real-time window
        console.log("received rtt of '" + msg.rtt + "'");
        rtt.value = msg.rtt; msg = msg.rtt;
        } else if (msg.requestFileId) {

                console.log("Request for file recieved.");
                //sendFileToPeer(msg.requestFileId);

        } else if (msg.chat) {
            // if full message, display in chat window,
            // reset real-time window,
            // and force chat window to last line
            console.log("received chat of '" + msg.chat + "'");
            //cb.value += msg.chat + "\n";
            ////TODO Move to SeshiSkinExample to keep seperate from API:
            var timeStamp = new Date();
            timeStamp = timeStamp.toString();
            timeStamp = timeStamp.substring(0,21);
            //Filter chat message
            chatData = filterXSS(msg.chat, {
                whiteList:          [],        // empty, means filter out all tags
                stripIgnoreTag:     true,      // filter out all HTML not in the whilelist
                stripIgnoreTagBody: ['script'] // the script tag is a special case, we need to filter out its content
                });
            var remoteChatMsg =
                '<li class="clearfix">' +
                '    <div class="message-data align-right">' +
                '    <span class="message-data-time">' + timeStamp +
                '    <span class="message-data-name">' +
                     msg.remoteDisplayName+
                '    </span>' +
                '    <i class="fa fa-circle me"></i></div>' +
                '    <div class="message other-message float-right">' +
                                chatData +
                '    </div>' +
                '</li>';
            cb.insertAdjacentHTML('beforeend', remoteChatMsg);
            cb.scrollTop = cb.scrollHeight; msg = msg.chat;
            //Dispatch event to UI informing it about the new chat message
            dispatchEvent(onNewChatMessage);

            } else if (msg.storeData) {
                console.log("Received data store message.");
                //console.log(blobURL);

            }
           };
    }

function sendChat(msg) {
	var cb = document.getElementById("chatbox"),
	//c = document.getElementById("chat");
    c = document.getElementById("message-to-send");

	//Display message locally, send it, and force chat window to
	// last line
	msg = msg || c.value;
	console.log("calling sendChat(" + msg + ")");
	//cb.value += "-> " + msg + "\n";
    //TODO Move (below) to SeshiSkinExample to keep seperate from API:
    var timeStamp = new Date();
    timeStamp = timeStamp.toString();
    timeStamp = timeStamp.substring(0,21);
    //Filter chat message
    chatData = filterXSS(msg, {
        whiteList:          [],        // empty, means filter out all tags
        stripIgnoreTag:     true,      // filter out all HTML not in the whilelist
        stripIgnoreTagBody: ['script'] // the script tag is a special case, we need to filter out its content
        });
    var localChatMsg =
            '<li>' +
            '<div class="message-data align-left">' +
            '    <span class="message-data-name">' +
            '        <i class="fa fa-circle online"></i> ' +
                        Seshi.getDisplayName() +
            '    </span>' +
            '<span class="message-data-time">' + timeStamp + '</span>' +
            '</div>' +
            '    <div class="message my-message">' +
                                chatData +
            '    </div>' +
            '</li>';
    cb.insertAdjacentHTML('beforeend', localChatMsg);

	data.send({'chat':msg, 'remoteDisplayName':Seshi.getDisplayName()});
	c.value = '';
	cb.scrollTop = cb.scrollHeight;
}





function zeroFill( number, width )
{
  width -= number.toString().length;
  if ( width > 0 )
  {
    return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
  }
  return number + ""; // always return a string
}//End zeroFill


function sendMostRecentFile() {
	//Get most recently added file (stored in localstorage.getItem('lastItem'))
	if(localStorage.getItem('lastItem'))
	{
	    fileId = localStorage.getItem('lastItem');
        //TODO send over datachannel
	}//Only send last item if localStorage.getItem('lastItem') has a fileId
}


function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}





///////////////////////////////////
// This next section is for attaching local media to the Peer
// Connection.
///////////////////////////////////

// This guard routine effectively synchronizes completion of two
// async activities:  the creation of the Peer Connection and
// acquisition of local media.
function attachMediaIfReady() {
  // If RTCPeerConnection is ready and we have local media,
  // proceed.
  if (pc) {attachMedia();}
}

// This routine adds our local media stream to the Peer
// Connection.  Note that this does not cause any media to flow.
// All it does is to let the browser know to include this stream
// in its next SDP description.
function attachMedia() {

  setStatus("Ready for call");
}


////////////////////////////
// This next section is for calling and answering
////////////////////////////

// This generates the session description for an offer
function call() {
  dc = pc.createDataChannel('chat');
  setupDataHandlers();
  pc.createOffer(gotDescription, doNothing, constraints);
}

// and this generates it for an answer.
function answer() {
  pc.createAnswer(gotDescription, doNothing, constraints);
}

// In either case, once we get the session description we tell
// our browser to use it as our local description and then send
// it to the other browser.  It is the setting of the local
// description that allows the browser to send media and prepare
// to receive from the other side.
function gotDescription(localDesc) {
  console.log("Local Description type: " + localDesc.type);
  console.log("Local Description sdp: " + localDesc.sdp);
  pc.setLocalDescription(localDesc,
                function(){console.log("Sucess setLocalDescription...");},
                function(error){console.log("Failed setLocalDescription...");});
  send(localDesc);
}


////////////////////////////////////
// This section is for changing the UI based on application
// progress.
////////////////////////////////////

// This function hides, displays, and fills various UI elements
// to give the user some idea of how the browser is progressing
// at setting up the signaling channel, getting local media,
// creating the peer connection, and actually connecting
// media (calling).
function setStatus(str) {
  var statuslineE = document.getElementById("statusline"),
      statusE = document.getElementById("status"),
      sendE = document.getElementById("send"),
      connectE = document.getElementById("connect"),
      callE = document.getElementById("call"),
      scMessageE = document.getElementById("scMessage");
      hangUp = document.getElementById("hangup");

  switch (str) {
    case 'Waiting':
      //statusE.innerHTML = "Sweet! Now send your friend this link: " + getShareLink();
      console.log("Sweet! Now send your friend this link: " + getShareLink() + " status: waiting");
      break;
    case 'Connected':
      //statuslineE.style.display = "inline";
      //connectE.style.display = "none";
      //scMessageE.style.display = "inline-block";
      //hangUp.style.display = "inline-block";
      break;
    case 'Ready for call':
      //statusE.innerHTML = "You rock! Now press connect:";
      //Auto click connect if user pasted URL
      if (document.location.search) //Search isn't empty if has ?key= in it.
      {
        //statusE.innerHTML = "Connecting to friend...";
        console.log("Connecting to friend...");
	    //var connectBtn = document.getElementById('call');
        //connectBtn.click()
        //call();
      }//End auto click connect if user pased URL

      //statusE.className = 'alert alert-info';
      //callE.style.display = "inline";
      break;
    case 'On call':
      console.log("On call");
      //statusE.innerHTML = "On call";
      //callE.style.display = "none";
      break;
    default:
  }

}

function log(msg) {
  console.log(msg);
}

function getShareLink() {
	var key = Seshi.getKey();
	return document.location.origin + '/?key=' + key;
}

function getQueryVariable(variable)
{
       //Credit: https://css-tricks.com/snippets/javascript/get-url-variables/
       var query = window.location.search.substring(1);
       var vars = query.split("&");
       for (var i=0;i<vars.length;i++) {
               var pair = vars[i].split("=");
               if(pair[0] == variable){return pair[1];}
       }
       return(false);
}

function processRecieveBuffer() {    

    if ( Seshi.recvBuffer.length == 0 )
    {
        processRecieveBufferFLAG = false;
        return; //Because we're done.
    }
        processRecieveBufferFLAG = true;
    /* Process each chunk in Seshi.ReciveBuffer */
    if( Seshi.recvBuffer.length > 0 ) {
                var blob = Seshi.recvBuffer.pop();
                //Get length of file meta (size specified is always a zerofilled 64byte long string at the begining of the blob
                var metaLength = blob.slice(0,81);
                //Read metaLength to get size in bytes of chunk fileMeta
                var reader2 = new FileReader();
                reader2.onload = function(file2) {
                        if ( reader2.readyState == FileReader.DONE ) {
                                result2 = file2.target.result;
                                var fileMetaLengthObj = JSON.parse(result2);
                                var fileMetaLength = parseInt(fileMetaLengthObj.metaLength);
                                window.fileMetaLength = fileMetaLength;
                                console.log("Meta length is:" + fileMetaLength);
                                    //Split file meta from begining of chunk (all chunk payloads are 64512 bytes in length)
                                    var chunkFileMeta = blob.slice(81, window.fileMetaLength + 81); //First get file type, chunk number etc
                                        var reader = new FileReader();
                                        reader.onload = function(file) {
                                                if ( reader.readyState == FileReader.DONE ) {
                                                        result = file.target.result;
                                                        if ( result.length > 0 ) {
                                                                window.curChunk = JSON.parse(result);
                                                                //Update window with current chunk information
                                                                //var chunkProgresTextBox = document.getElementById('chunkInProgress');
                                                                var message = "File id: " + curChunk.fileId + " ChunkNumber: ";
                                                                message += curChunk.chunkNumber + " Filetype: " + curChunk.fileType;
                                                                message += " FileName: " + curChunk.fileName;

                                                                var chunkProg = (curChunk.chunkNumber + 1) / curChunk.numberOfChunks * 100;
                                                                //Update user facing status box
                                                                if (chunkProg == 100)
                                                                {
                                                                    statusMsg = 'Complete!: "' + curChunk.fileName + ' 100%';
                                                                } else {
                                                                    statusMsg = 'Reciving file: "' + curChunk.fileName + '" Chunk number: ' + curChunk.chunkNumber;
                                                                }
                                                                statusE = document.getElementById("status"),
                                                                statusE.innerHTML = statusMsg;
                                                                if (curChunk.chunkNumber == curChunk.numberOfChunks) {
                                                                        refreshFileList('localFileList');
                                                                }//End refresh
                                                                //End extract file meta from blob
                                                        }//End check read data is > 0
                                                                //Start send data payload
                                                                var headerOffset = 81 + window.fileMetaLength;
                                                                //var chunkBlob = blob.slice(headerOffset); //Get chunk payload
                                                                var chunk = blob.slice(headerOffset); //Get chunk payload
                                                                //Store chunkBlob into IndexedDB
                                                                //Use Seshi.store() API (should move file header parsing to this web worker also...)
  
                                                                var storeReqObj = {
                                                                    "dataSource"    : "seshiChunk",
                                                                    "boxId"         : Seshi.getBoxId(),
                                                                    "chunk"         : chunk,
                                                                    "chunkNumber"   : window.curChunk.chunkNumber,
                                                                    "chunkSize"     : window.curChunk.chunkSize,
                                                                    "fileId"        : window.curChunk.fileId,
                                                                    "fileName"      : window.curChunk.fileName,
                                                                    "fileType"      : window.curChunk.fileType,
                                                                    "numberOfChunks": window.curChunk.numberOfChunks
                                                                };
                                                                var storePromise = new Promise(function(resolve, reject) 
                                                                { 
                                                                    StorageWorker.postMessage(storeReqObj);
                                                                    StorageWorker.addEventListener("message", function(e) {
                                                                        resolve(e.data);
                                                                    });
                                                                    return storePromise;
                                                                });
                                                                //End send data chunk payload
                                                                storePromise.then(function() {
                                                                    //Send back ACK to remote peer with progess update
                                                                     var peerReceivedChunkACK = {
                                                                         'cmd':'receivedChunkACK',
                                                                         'data':{
                                                                                    'boxId'         : Seshi.getBoxId(),
                                                                                    'fileId'        : window.curChunk.fileId,
                                                                                    "fileName"      : window.curChunk.fileName,
                                                                                    "fileType"      : window.curChunk.fileType,
                                                                                    "numberOfChunks": window.curChunk.numberOfChunks,
                                                                                    'chunkNumber'   : window.curChunk.chunkNumber,
                                                                                    'chunkSize'     : window.curChunk.chunkSize
                                                                                }
                                                                     };
                                                                     //Send chunk received ACK over datachannel to peer
                                                                     peerReceivedChunkACK = JSON.stringify(peerReceivedChunkACK);
                                                                     dc.send(peerReceivedChunkACK);

                                                                    processRecieveBuffer();//Check for more chunks in recvBuffer
                                                                });//End then check for next chunk in recvBuffer
                                                }//End reader.readtState == DONE
                                        }//End reader.onload
                                        reader.readAsText(chunkFileMeta);
                                        //End extract file meta from blob
                        }//End IF reading byte lenth of fileMeata
                }//End get bytelength of fileMeta
                reader2.readAsText(metaLength);
 }//End if Seshi.recvBuffer is < 0.

}//End processRecieveBuffer.

/* Event listeners:
 * - For a cleaner UI developer experience by
 *   avoiding inline Javascript e.g: onclick="example()"
 *
 * Rather than interfere with the UI like this,
 * attach event listeners to the UI components which
 * trigger events.
 * For example:
 *
 * When user clicks generate key button, register an
 * event which responds to this action & call the
 * function responsible for generating a share url.
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
*/

//Event: When user clicks copy keybutton, generatee a share URL
copyKeyBtn = document.getElementById('copyclipboard');
//Attach createShareUrl event listener to each share url button
copyKeyBtn.addEventListener('click', createShareUrl, false);


// Init helper tooltips
$(function () {
      $('[data-toggle="tooltip"]').tooltip()
})

//Event: When user clicks 'send' button, check which files are marked,
//send them over the datachannel
var sendBtn = document.getElementById('sendBtn');
sendBtn.addEventListener('click', sendSelectedFiles, false);

//Event: When user uses drop down menu to delete selected (checkbox items)
var multiDeleteBtn = document.getElementById('multiDeleteLocalFiles');
multiDeleteBtn.addEventListener('click', deleteSelectedFiles, false);

//Event: When user uses drop down menu to dowload selected local files (checkboxes)
var multiDownloadBtn = document.getElementById('multiDownloadLocalFiles');
multiDownloadBtn.addEventListener('click', function(){ downloadSelectedFiles(); }, false);

//Event: When user requests to 'Receive' (pull) a file to their device
var multiPullBtn = document.getElementById('receiveBtn');
multiPullBtn.addEventListener('click', pullSelectedFiles, false);

//Event: Chat- user sets their display name by hitting <enter> key
var displayNameInput = document.getElementById('display-name');
  // Set display name if already set
  displayNameInput.value = Seshi.getDisplayName();
displayNameInput.addEventListener('keydown', setDisplayName, false);//If user presses enter key
displayNameInput.addEventListener('blur', setDisplayName, false);//User leaves focus of input

//Event: Chat, when user clicks the send message button, send message
var sendMsg = document.getElementById('sendMsg');
sendMsg.addEventListener('click', function(){sendChat()});


//Event: When we have a true Peer-to-Peer data connection established:
window.addEventListener('onPeerConnectionEstablished', showConnected, false);

//Event: Peer-to-Peer data connection is BROKEN :'( :
window.addEventListener('onPeerConnectionBroken', peerConnectionBroken, false);

//Event: Recieved file listing of connected peer
window.addEventListener('gotRemoteFileList', function(){updateFileListDisplay(Seshi.remoteFileList, 'remoteFileList');}, false);

//Event: Chat message received:
window.addEventListener('onNewChatMessage', newChatMessageReceived, false);

//Event: Storage worker has stored more chunks of a file(s)
window.addEventListener('storeFilesProgressUpdate', updateStoreProgressDisplay, false);

//Event: sendFileProgressUpdate recived
window.addEventListener('sendFileProgressUpdate', updateSendFileProgessDisplay, false);

//Event: displayName of remote user is recived
window.addEventListener('onGotRemoteDisplayName', showRemoteDisplayName, false);

//Init plyr
    // plyr Settings:
    var options = {
               'controls':["restart", "rewind", "play", "fast-forward", "current-time", "duration", "mute", "volume", "captions", "fullscreen"]
                }
    var player = plyr.setup()[0];

//Event: onPlayInSyncRequest is fired
window.addEventListener('playRequest', play, false);
window.addEventListener('resumePlayRequest', resumePlay, false);

//Event: onSeshiPauseReq fired
window.addEventListener('onSeshiPauseReq', pause, false);


//Event: Seshi Skin Pause event (user clicks pause)
document.querySelector(".plyr").addEventListener("pause", function() {
      console.log("Pause button on Plyr was pressed.");
      //dispatchEvent(SeshiSkinPause);
});

//Event: Seshi Skin Pause event (user clicks pause)
document.querySelector(".plyr").addEventListener("play", function() {
      console.log("Play button on Plyr was pressed.");
      //dispatchEvent(SeshiSkinPlay);
});


function tickAllFiles(list) {

    //Work out which file box we're playing with, based on 'list' <<- value of list is set by  event listner
    list == 'checkAll-remoteFileList' ? fileList = "remoteFileCheckBox" : fileList = "localFileCheckBox";

    //Get the value of the toggle check box
    var newState = document.getElementById(list).checked;

    //Set each file's checkbox to the value of the toggler
    var fileList = document.getElementsByClassName(fileList);
    for(var i=0; i< fileList.length; i++) {
                fileList[i].checked = newState;
    }//End loop though local files list ticking each file
}//End checkAll local files

function peerConnectionBroken() {
    /* Called by event listener when sendFileProgressUpdate event is fired
     *  Used to display a break in Datachannel connection.
     * */
    alert("Peer has disconnected");
    alert("Hold on, we'll try and reconnect");

    $("#remoteFileListContainer").fadeOut();
    $("#sendIdThenHide").show();
    $("connectionStatus").hide();
    // var connectionStateBox = document.getElementById('connectionStatus');
    // connectionStateBox.innerText = 'Atempting Reconnect...';
    connect();

    //Disable Send / Recieve buttons:
    var receiveBtn = document.getElementById('receiveBtn').disabled = true;
    var sendBtn = document.getElementById('sendBtn').disabled = true;

    //Disable chat button / Show online status
    var chatToggleBtn = document.getElementById('chatToggle');
    chatToggleBtn.innerText  = "CHAT: Offline"
    //End show show tollge button status

}//End peerConnectionBroken()


function createShareUrl() {
    /* createShareUrl()
     * - Creates a share url when user clicks 'generate key' button &
     *   automatically sends this key to the signaling server.
     *
    */

    //Generate a new key for the user
    var key = Seshi.setKey();

    //Build share url:
    console.log("Generated share url: \n" + Seshi.getShareUrl());

    //send this key to signaling server
    connectToSignalServer();

    //Update UI: Replace the generate key button s message telling user
    //what to do next:
    replaceGenerateKeyBtn();

    //Update Whatsapp share button
    updateWhatsAppShareBtn();

    //Clipboard
    var copyIcon = document.getElementById('copyclipboard')
    //Set data-shareurl
    copyIcon.dataset.shareurl = Seshi.getShareUrl();
    new Clipboard('#copyclipboard', {
        text: function(trigger) {
            return trigger.getAttribute('data-shareurl');
        }
    });

}//End createShareUrl()


function connectToSignalServer() {
    /* Send key to signal server to create signaling channel
     *
     * A signalling channel is between THREE nodes:
     *   > Person A
     *   > Signaling Server
     *   > Person B
     * The signaling server passes messages containing
     * each person's connection information.
     *
     * Once both persons have connection information for
     * eachother, they can connect directly forming a
     * peer-to-peer connection.
     */
     connect(); //Defined in Seshi.js (TODO attach this to seshi api)
}//End connectToSignalServer()


function replaceGenerateKeyBtn() {
    /* Replaces the generate key button with a 'connecting' message
     * Note, this function presumes that the key has already been
     * sent to the signaling server (connectToSignalServer()).
     */

    //Get reference to Generate Key button
    generateKeyBtn = document.getElementById('connectionStatus');

    //Create replacement 'button' <<-- This is just to match UI, the user dosn't need to click it.
    var connectBtn = document.createElement('p');
    connectBtn.id = 'connectionStatus';
    connectBtn.className = '' ;
    connectBTnText = document.createTextNode("waiting for friend to receive key"); //Message shown to user on button
    connectBtn.appendChild(connectBTnText);

    var parentDiv = generateKeyBtn.parentNode; //Locate the parent node of the existing button.
    parentDiv.replaceChild(connectBtn, generateKeyBtn); //Replace the old button with the new
}//replaceGenerateKeyBtn()


function updateWhatsAppShareBtn() {
    var whatsAppShareBtn = document.getElementsByClassName('whatsapp');
    //Update href with share url
    whatsAppShareBtn[0].href = 'whatsapp://send?text=' + Seshi.getShareUrl();
}//End updateWhatsAppShareBtn


function play(event) {
    console.log("My player implimentation...");

    //Determine if local play request or remote
    if ( undefined !== event.target.dataset ) //Local play req
    {
        fileId = event.target.dataset.id;
    } else if ( undefined !== event.detail.fileId.fileId )
    {
        fileId = event.detail.fileId.fileId;
    } else if ( undefined !== event.detail.fileId) //Remote play req
    {
        fileId = event.detail.fileId;
    }//End determine if local play request or remote

    Seshi.generateObjectUrl(fileId).then(
            function(objectInfo){
                //Music or Audio?
                var mimeType = objectInfo.mimeType;
                //Detemine mimetype & show media player accordingly
                if (objectInfo.mimeType.includes('audio'))
                {
                        $('.plyr').show()
                        mediaType = 'audio';
                        $("#hideall").css('position', 'relative');
                        $('.plyr').css({
                            'position': 'fixed',
                            'bottom': '0',
                            'width': '100%',
                            'z-index':'1001'
                                });
                            $('.btn-hide').hide();
                            $("#hideall").removeClass('widthOpenVideo');
                } else if (objectInfo.mimeType.includes('video')) {
                        mediaType = 'video';
                          $('.plyr').show();
                        if ($(window).width() > 992) {
                          $('.plyr').css({
                              'position': 'relative',
                              'width': '100%',
                              'z-index':'999'
                                  });
                          $("#hideall").css({'position':'absolute',
                                              'margin': '0 auto'});
                          $("#addfilehide").hide();
                          $("#hideall").hide();

                          $("#hideall").addClass('widthOpenVideo');
                          $("#addfilehide").addClass('showtoggle');
                          $("#hideall").addClass('showtoggle');
                          $('.btn-hide').show();
                        } else if ($(window).width() < 992 && $(window).width() > 768 ) {
                          $('.plyr').css({
                              'position': 'fixed',
                              'bottom': '0',
                              'width': '62%',
                              'z-index':'1001'
                                  });
                          $("#hideall").css('position', 'relative');
                            $("#hideall").show();
                            $('.btn-hide').hide();
                        }  else if ($(window).width() < 768 && $(window).width() > 480) {
                          $('.plyr').css({
                              'position': 'fixed',
                              'bottom': '0',
                              'width': '72%',
                              'z-index':'1001'
                                  });
                            $("#hideall").show();
                            $('.btn-hide').hide();
                          }   else if ($(window).width() < 480) {
                            $('.plyr').css({
                                'position': 'fixed',
                                'bottom': '0',
                                'width': '100%',
                                'z-index':'1001'
                                    });
                            $("#hideall").show();
                            $('.btn-hide').hide();
                            }
                } else {
                          $('.plyr').show();
                        mediaType = 'audio';
                        //Default to audio (why? becuse we don't want a big black video screen unesseserily)

                }//End music or audio check

                player.source({
                                type:       mediaType,
                                title:      objectInfo.fileName,
                                sources: [{
                                    src: objectInfo.objectURL,
                                    type:     objectInfo.mimeType
                                }]});
                player.play(); //Play the chosen media
                localStorage.setItem('currentlyPlaying', fileId);
            });
}//End play()

function pause() {
    //Callled onSeshiPauseReq event received from remote peer

    //Get reference to player
    var player = document.querySelector('.plyr');
    player.plyr.pause(); //Pause media
}//End pause()

function resumePlay() {
    //Called on resumePlayRequest event
    //Get reference to player
    var player = document.querySelector('.plyr');
    player.plyr.play(); //play media (unpause)
}//End resumePlay()

function download(event) {
    fileId = event.target.dataset.id;
    Seshi.download(fileId);
}

function share(event) {
    //Check a peer is actually connect so we can send them the file
    if (Seshi.connectionStatus.dataChannelState() == "open") {
        fileId = event.target.dataset.id;
        Seshi.sendFileToPeer(fileId)
    } else { //Not connected to a peer!
        alert("You need to be connected to a peer in order to send them a file. Click button <x> or / automatically show share box to user...");
    }
}

function refreshFileList(listId) {
    //Show loading throbber css animation whilst refreshing file list

    var throbberId = 'throbber-' + listId;
    var throbber = '<div id="' + throbberId + '" class="ball-pulse">' +
                    '<div></div>' +
                    '<div></div>' +
                    '<div></div>' +
                    '</div>';

    document.getElementById('header-' + listId).insertAdjacentHTML('afterend', throbber);

    // Seshi..updateLocalFilesList() returns a promise, therefore we must 'wait' for it to resolve.
    Seshi.updateLocalFilesList().then( // .then() we know the .localFileList cache is updated, so we display the fresh list.
            function(complete){
                //Remove throbber
                document.getElementById(throbberId).remove();
                updateFileListDisplay(Seshi.localFileList(), listId);
                //If peer connection is established, resend new local file list to peer
                if(Seshi.connectionStatus.dataChannelState() == 'open')
                {
                    Seshi.sendLocalFileListToRemote();
                }//End if peer connection is established, resend new local file list to peer.
            });

}//End refreshFileList()

function storeFile(fileList){
    Seshi.store({'dataSource':'fileSystem','data':fileList});
    //Scroll to file list so user can see storing progress bar indicator:
    smoothScroll('shareButtonsRow');
}

function deleteFile(event){
        fileId = event.target.dataset.id;
        Seshi.deleteFile(fileId);
        refreshFileList('localFileList');
}


/* Show 'connecting' instead of generate key box if 'key' is in URI
 * and user isn't trying to connect to themselves
 * */
if (getQueryVariable("key")) {
    //Get reference to Generate Key button


    generateKeyBtn = document.getElementById('connectionStatus');

    var connectionStatusMessage= document.createElement('p');
    connectionStatusMessage.id = 'connectionStatus';
    if(getQueryVariable("key") != localStorage.getItem('key'))
    {
      $("#sendIdThenHide").hide();
      $("#connectionStatus").show();
        connectionStatusMessageText = document.createTextNode("Connecting..."); //Message shown to user on button
    } else {
        connectionStatusMessageText = document.createTextNode("Hey! It looks like you've sent the key to yourself, send it to a friend to share files with them.");
    }//End if user has connected to themself, explain the situation..

    connectionStatusMessage.appendChild(connectionStatusMessageText);

    var parentDiv = generateKeyBtn.parentNode; //Locate the parent node of the existing button.
    parentDiv.replaceChild(connectionStatusMessage, generateKeyBtn); //Replace the old button with the new

}//End show 'connecting' instead of generate key box if 'key' is in URI */


function showConnected() {

    $("#sendIdThenHide").hide();
    $("#remoteFileListContainer").fadeIn();

    //Get reference to 'connecting' UI button
    if (targetBtn = document.getElementById('connectionStatus')) {

    } else {
        targetBtn = document.getElementById('connect');
    }

    //Create replacement 'button' <<-- This is just to match UI, the user dosn't need to click it.
    var connectedBtn= document.createElement('p');
    connectedBtn.id = 'connectionStatus';
    connectedBtn.className = '';
    connectedBtnText = document.createTextNode("Connected!"); //Message shown to user on button
    connectedBtn.appendChild(connectedBtnText);
    var parentDiv = targetBtn.parentNode; //Locate the parent node of the existing button.
    parentDiv.replaceChild(connectedBtn, targetBtn); //Replace the old button with the new
      $("#connectionStatus").hide();

    //Enable Send / Recieve buttons:
    var receiveBtn = document.getElementById('receiveBtn').disabled = false;
    var sendBtn = document.getElementById('sendBtn').disabled = false;

    //Enable chat button / Show online status
    var chatToggleBtn = document.getElementById('chatToggle');
    chatToggleBtn.innerText  = "CHAT: Connected!"
    //End show show tollge button status

}//End showConnected


function newChatMessageReceived() {
    /* newChatMessageReceived gets called after the
     * onNewChatMessage event is dispatched. We listen
     * for that event to fire, and when it does, this
     * function gets called.
     */
    console.log('newChatMessageReceived() called.');

  $("#message").fadeIn();
    $(".btn-chat-toggle").on('click', function() {
      $("#message").fadeOut();
    });


} //End newChatMessageReceived()


function getFileTypeIcon(mimeType) {

    switch(mimeType) {
        case 'audio/mp3':
        case 'audio/ogg':
             return 'fa-music';
        case 'video/mp4':
        case 'video/ogg':
        case 'video/3gpp':
        case 'video/x-msvideo':
        case 'video/x-flv':
             return 'fa-film';
        case 'image/jpeg':
        case 'image/png':
        case 'image/svg+xml':
             return 'fa-file-image-o';
        case 'application/pdf':
             return 'fa-file-pdf-o';
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
              return 'fa-file-word-o';
        case 'text/html':
        case 'text/css':
              return 'fa-file-code-o';
        case 'text/csv':
        case 'text/plain':
        case 'application/x-latex':
        case 'application/x-tex':
              return 'fa-file-text-o';
        default:
             return mimeType;
    }

}//End getFileTypeIcon(mimeType)


/* Update files list UI */
function updateFileListDisplay(fileListObj, targetElm) {
    var files = fileListObj;
    var list = '';

    //Determine checkAll id
    switch(targetElm) {
        case 'localFileList':
            checkAllId =  'checkAll-localFileList';
            break;
        case 'remoteFileList':
            checkAllId = 'checkAll-remoteFileList';
            break;
    }//End determine checkall id
    if(files)
    {
        console.log("There are " + files.length + " " + targetElm + " files");
    }

    //Loop through each
    for(var i=0;i<files.length;i++) {

        var fileId = files[i].fileId;
        var fileName = files[i].fileName;
        var mimeType = files[i].fileType;
        var checkBoxClass = targetElm == 'localFileList' ? 'localFileCheckBox' : 'remoteFileCheckBox';

        //Open <li>
        list += '<li class="list-group-item file-item row">\n';
        //Checkbox
        list += '<input class="col-xs-1 ' + checkBoxClass + '" type="checkbox" id="' + fileId + '" data-id="' + fileId + '">\n';
        //Checkbox label & file name
        list += '<label class="col-xs-6 table-border name-label" for="' + fileId + '">' + fileName + '</label>\n';
        //Filetype
        list += '<label class="col-xs-2 name-label" for="' + fileId + '"><i class="fa ' + getFileTypeIcon(mimeType) + '"></i></label>';
        if (targetElm != 'remoteFileList' ) //Only show action buttons (delete, play, download) on the local file list side)
        {
            //Delete button
            list += '<div class="col-xs-1 hidden-xs"><i title="Delete" onclick="deleteFile(event)" data-id="' + fileId + '" class="fa fa-trash  "></i></div>';
            //Play button
                //Only show play button if file is playable
                if(Seshi.isPlayable(mimeType, fileName))
                {
                    list += '<div class="col-xs-1 playoptions"><a title="Play"><i onclick="play(event)" data-id="' + fileId + '" class="fa fa-play"></i></a></div>';
                }else {
                    list += '<div class="col-xs-1 "></div>';
                }//End only show play button if file is playable
            //Download button
            list += '<div class="col-xs-1 "><i onclick="download(event)" title="Download" data-id="' + fileId + '" class="fa fa-arrow-down"></i></div>';
        }//End if targetElm != 'remoteFileList'
// <a class="playsync"><i data-toggle="tooltip" data-placement="bottom" title="play in sync" class="fa fa-exchange"></i></a>
        //Close </li>
        list += '</li>';
    }//End loop through each local file list (cached) and build list items
    //Update display with local files list
    var fileBoxList = document.getElementById(targetElm);//Get reference to file box
    var numFilesInList = fileBoxList.children.length;

    for(var i=1; i < numFilesInList; i++) //Remove all current items from local file list
    {
       fileBoxList.removeChild(fileBoxList.children[0]);
    }//End remove all current items in list ready for replacement

    //Update table with file list:
    fileBoxList.innerHTML = list;

}//updateFileListDisplay()


updateFileListDisplay(Seshi.localFileList(), 'localFileList');



function updateStoreProgressDisplay() {

    //Loop through each item in Seshi.storeProgress & update the display accordingly
    for ( var fileId in Seshi.storeProgress) {
        if(Seshi.storeProgress[fileId].UIdone == false)
        {
            Seshi.storeProgress[fileId];
            var fileName = Seshi.storeProgress[fileId].fileName;
            var valueNow = parseInt((Seshi.storeProgress[fileId].currentChunk + 1) / Seshi.storeProgress[fileId].totalNumChunks * 100);
            var totalNumChunks = Seshi.storeProgress[fileId].totalNumChunks;
            var complete = Seshi.storeProgress[fileId].complete;

            var output = '';
            output += '<li class="list-group-item file-item uploading-item row" id="storingFileId-' + fileId + '">';
                        //Filename
            output += '<div class="col-xs-4 col-sm-4 name-label">' + fileName + '</div> ';
                        //Progress bar
            output += '<div class="col-xs-6  col-sm-6">';
            output += '<div class="uploading active" role="progressbar" aria-valuenow="' + valueNow + '" aria-valuemin="0" aria-valuemax="100" style="width: 100%">';
            output += '<span class="uploadbar" style="width: ' + valueNow + '%;"></span>';
            output += '</div>';
            output += '</div>';
                        //Percentage complete
            output += '<div class="col-xs-1 col-sm-1">';
            output += '<div id="percentupload">' + valueNow + '%</div>';
            output += '</div>';
            output += '</li>';

             //If complete, check for existing progress bar and delete it
             if (valueNow >= 100) {
                    if (document.getElementById('storingFileId-' + fileId)) {//Get reference to progress bar
                        document.getElementById('storingFileId-' + fileId).remove();
                        refreshFileList('localFileList');
                    }else if ( totalNumChunks == 1) {
                        refreshFileList('localFileList');//Refresh filelist for tiny (one chunk) files too (they don't have a progress bar)
                    }
                    //Set UI complete flag
                    Seshi.storeProgress[fileId].UIdone = true;
             }else { // End ff valueNow >= 100 refresh locaFileList
                //otherwise, replace any existing progress bar to the list
                    if (document.getElementById('storingFileId-' + fileId)) {
                        document.getElementById('storingFileId-' + fileId).remove();
                    }
                    document.getElementById('localFileList').insertAdjacentHTML('afterbegin', output);
             }//End if not complete
         }//End check Seshi.storeProgress[fileId].UIdone == false before proceeding (prevents itterating over already completed UI updates.
    }//End loop through each item in Seshi.storeProgress & update the display accordingly



}//End updateStoreProgressDisplay()


function sendSelectedFiles() {

    //Get list of files user has selected for sending
    var localFileCheckBoxes = document.getElementsByClassName('localFileCheckBox');
    //Only send if datachannel is open!
    if (Seshi.connectionStatus.iceConnectionState() == "connected" || Seshi.connectionStatus.iceConnectionState() == 'completed')
    {
        for(var i=0; i< localFileCheckBoxes.length; i++) {
            if (localFileCheckBoxes[i].checked == true)
            {
                Seshi.sendFileToPeer(localFileCheckBoxes[i].dataset.id); //Send over dataChannel
            }//End only send if file's checkbox it checked.
        }//Loop though each localfile checkbox & send file over datachannel if checked

        //Unckeck all files after sending to prevent user resending same files accidentally
        for(var i=0; i< localFileCheckBoxes.length; i++) {
            localFileCheckBoxes[i].checked = false;
        }//End Unckeck all files after sending to prevent user resending same files accidentally
    }//End only send if datachannel is open
}//End sendSelectedFiles()


function deleteSelectedFiles() {

    var localFileCheckBoxes = document.getElementsByClassName('localFileCheckBox');
    for(var i=0; i< localFileCheckBoxes.length; i++) {
        //Check file is selected before deleting
        if (localFileCheckBoxes[i].checked == true)
        {
            Seshi.deleteFile(localFileCheckBoxes[i].dataset.id);
        }//End check file is selected before deleting
    }//Wns loop through all selected files, deleting them if selected
    refreshFileList('localFileList');
}//End deleteSelectedFiles()

function downloadSelectedFiles() {
    var localFileCheckBoxes = document.getElementsByClassName('localFileCheckBox');
    for(var i=0; i< localFileCheckBoxes.length; i++) {
        //Check file is selected before downloading
        if (localFileCheckBoxes[i].checked == true)
        {
            Seshi.download(localFileCheckBoxes[i].dataset.id);
        }//Only downlod selected files
    }//End loop though local files list checking for selected files for download
}//End downloadSelectedFiles()



function pullSelectedFiles() {
    var remoteFileCheckBoxes = document.getElementsByClassName('remoteFileCheckBox');
    var requestedFiles = [];
    for(var i=0; i< remoteFileCheckBoxes.length; i++) {
        //Check file is selected before collecting
        if (remoteFileCheckBoxes[i].checked == true)
        {
            requestedFiles.push(
                    {
                        fileId: remoteFileCheckBoxes[i].dataset.id,
                        requestType:'ALL'
                    });
        }//Only collect files wanting to be pulled
    }//End loop though remote files list checking for selected files the user wants

    //Send pull request if not empty:
    if(requestedFiles.length > 0)
    {
        Seshi.requestFilesFromPeer(requestedFiles);
    }//End send pull request to peer

}//End pullSelectedFiles()

function updateSendFileProgessDisplay() {
//Called upon sendFileProgressUpdate event being fired

    for (var fileId in Seshi.sendingFileProgress)
    {
        if(Seshi.sendingFileProgress[fileId].UIdone == true) {
            continue; //Dont re-add progress bar as file is 100% sent
        };
        var file = Seshi.sendingFileProgress[fileId];
        var fileName = file.fileName;
        var fileType = file.fileType;
        var chunkNumber = file.chunkNumber;
        var numberOfChunks = file.numberOfChunks;
        var valueNow = parseInt((file.recvChunkCount + 1) / numberOfChunks * 100);
        var complete = file.recvChunkCount >= numberOfChunks ? true:false;

        var output = '';
        output += '<li class="list-group-item file-item uploading-item row" id="sendingFileId-' + fileId + '">';
                    //Filename
        output += '<div class="col-xs-4 col-sm-3">' + fileName + '</div> ';
                    //Progress bar
        output += '<div class="col-xs-5  col-sm-6">';
        output += '<div class="uploading active" role="progressbar" aria-valuenow="' + valueNow + '" aria-valuemin="0" aria-valuemax="100" style="width: 100%">';
        output += '<span class="uploadbar" style="width: ' + valueNow + '%;"></span>';
        output += '</div>';
        output += '</div>';
                    //Percentage complete
        output += '<div class="col-xs-1 col-sm-1">';
        output += '<div id="percentupload">' + valueNow + '%</div>';
        output += '</div>';
                    //Cancell button
        output += '<div class="col-xs-1 col-sm-1">';
        output += '<i class="fa fa-times "></i>';
        output += '</div>';
        output += '<div class="col-xs-1 col-sm-1"></div>';
        output += '</li>';

         //If complete, check for existing progress bar and delete it
         if (valueNow >= 100) {
             //Set UI complete flag
             Seshi.sendingFileProgress[fileId].UIdone = true;
             //Remove completed 'sending file' progress bar from senders UI
                if (document.getElementById('sendingFileId-' + fileId)) {
                    document.getElementById('sendingFileId-' + fileId).remove();
                }
         } else { //End if complete
                //If not complete:
                if (document.getElementById('sendingFileId-' + fileId)) {
                    document.getElementById('sendingFileId-' + fileId).remove();
                }
                document.getElementById('remoteFileList').insertAdjacentHTML('afterbegin', output);
         }//End if not complete
        }//End loop though Seshi.sendingFileProgress showing sending file progress udates per file

}//End updateSendFileProgessDisplay()



function setDisplayName(e) {
    if(e.keyCode == 13 || e.type == 'blur') {
        var displayName = document.getElementById('display-name').value;
        Seshi.setDisplayName(displayName);
    }//End if enter key pressed, set display name
}//End setDisplayName()



function showRemoteDisplayName() {
    /* Called automatically when onGotRemoteDisplayName event is fired
     *
     * Updated UI with the 'Chatting to <user/device> message
    *
    */
    //Get reference to connected peers display name (remote peer)
    var displayNameBox = document.getElementById('remoteDisplayName');
    //Update value with the remote's display name (which could be anything...)
    displayNameBox.innerHTML = Seshi.getRemoteDisplayName();

}//End showRemoteDisplayName()





function smoothScroll(eID) {
    function currentYPosition() {
        // Firefox, Chrome, Opera, Safari
        if (self.pageYOffset) return self.pageYOffset;
        // Internet Explorer 6 - standards mode
        if (document.documentElement && document.documentElement.scrollTop)
            return document.documentElement.scrollTop;
        // Internet Explorer 6, 7 and 8
        if (document.body.scrollTop) return document.body.scrollTop;
        return 0;
    }

    function elmYPosition(eID) {
    var elm = document.getElementById(eID);
    var y = elm.offsetTop;
    var node = elm;
    while (node.offsetParent && node.offsetParent != document.body) {
        node = node.offsetParent;
        y += node.offsetTop;
    } return y;
    }
    var startY = currentYPosition();
    var stopY = elmYPosition(eID);
    var distance = stopY > startY ? stopY - startY : startY - stopY;
    if (distance < 100) {
        scrollTo(0, stopY); return;
    }
    var speed = Math.round(distance / 10);
    if (speed >= 20) speed = 20;
    var step = Math.round(distance / 25);
    var leapY = stopY > startY ? startY + step : startY - step;
    var timer = 0;
    if (stopY > startY) {
        for ( var i=startY; i<stopY; i+=step ) {
            setTimeout("window.scrollTo(0, "+leapY+")", timer * speed);
            leapY += step; if (leapY > stopY) leapY = stopY; timer++;
        } return;
    }
    for ( var i=startY; i>stopY; i-=step ) {
        setTimeout("window.scrollTo(0, "+leapY+")", timer * speed);
        leapY -= step; if (leapY < stopY) leapY = stopY; timer++;
    }
}

//Event: User clicks 'check all' button on a files list
var localCheckAll = document.getElementById('checkAll-localFileList');
localCheckAll.addEventListener('click', function(){ tickAllFiles('checkAll-localFileList');}, false);

var remoteCheckAll = document.getElementById('checkAll-remoteFileList');
remoteCheckAll.addEventListener('click', function(){ tickAllFiles('checkAll-remoteFileList');}, false);

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * 默认配置
 *
 * @author 老雷<leizongmin@gmail.com>
 */

var FilterCSS = require('cssfilter').FilterCSS;
var _ = require('./util');

// 默认白名单
function getDefaultWhiteList () {
  return {
    a:      ['target', 'href', 'title'],
    abbr:   ['title'],
    address: [],
    area:   ['shape', 'coords', 'href', 'alt'],
    article: [],
    aside:  [],
    audio:  ['autoplay', 'controls', 'loop', 'preload', 'src'],
    b:      [],
    bdi:    ['dir'],
    bdo:    ['dir'],
    big:    [],
    blockquote: ['cite'],
    br:     [],
    caption: [],
    center: [],
    cite:   [],
    code:   [],
    col:    ['align', 'valign', 'span', 'width'],
    colgroup: ['align', 'valign', 'span', 'width'],
    dd:     [],
    del:    ['datetime'],
    details: ['open'],
    div:    [],
    dl:     [],
    dt:     [],
    em:     [],
    font:   ['color', 'size', 'face'],
    footer: [],
    h1:     [],
    h2:     [],
    h3:     [],
    h4:     [],
    h5:     [],
    h6:     [],
    header: [],
    hr:     [],
    i:      [],
    img:    ['src', 'alt', 'title', 'width', 'height'],
    ins:    ['datetime'],
    li:     [],
    mark:   [],
    nav:    [],
    ol:     [],
    p:      [],
    pre:    [],
    s:      [],
    section:[],
    small:  [],
    span:   [],
    sub:    [],
    sup:    [],
    strong: [],
    table:  ['width', 'border', 'align', 'valign'],
    tbody:  ['align', 'valign'],
    td:     ['width', 'colspan', 'align', 'valign'],
    tfoot:  ['align', 'valign'],
    th:     ['width', 'colspan', 'align', 'valign'],
    thead:  ['align', 'valign'],
    tr:     ['rowspan', 'align', 'valign'],
    tt:     [],
    u:      [],
    ul:     [],
    video:  ['autoplay', 'controls', 'loop', 'preload', 'src', 'height', 'width']
  };
}

// 默认CSS Filter
var defaultCSSFilter = new FilterCSS();

/**
 * 匹配到标签时的处理方法
 *
 * @param {String} tag
 * @param {String} html
 * @param {Object} options
 * @return {String}
 */
function onTag (tag, html, options) {
  // do nothing
}

/**
 * 匹配到不在白名单上的标签时的处理方法
 *
 * @param {String} tag
 * @param {String} html
 * @param {Object} options
 * @return {String}
 */
function onIgnoreTag (tag, html, options) {
  // do nothing
}

/**
 * 匹配到标签属性时的处理方法
 *
 * @param {String} tag
 * @param {String} name
 * @param {String} value
 * @return {String}
 */
function onTagAttr (tag, name, value) {
  // do nothing
}

/**
 * 匹配到不在白名单上的标签属性时的处理方法
 *
 * @param {String} tag
 * @param {String} name
 * @param {String} value
 * @return {String}
 */
function onIgnoreTagAttr (tag, name, value) {
  // do nothing
}

/**
 * HTML转义
 *
 * @param {String} html
 */
function escapeHtml (html) {
  return html.replace(REGEXP_LT, '&lt;').replace(REGEXP_GT, '&gt;');
}

/**
 * 安全的标签属性值
 *
 * @param {String} tag
 * @param {String} name
 * @param {String} value
 * @param {Object} cssFilter
 * @return {String}
 */
function safeAttrValue (tag, name, value, cssFilter) {
  cssFilter = cssFilter || defaultCSSFilter;
  // 转换为友好的属性值，再做判断
  value = friendlyAttrValue(value);

  if (name === 'href' || name === 'src') {
    // 过滤 href 和 src 属性
    // 仅允许 http:// | https:// | mailto: | / | # 开头的地址
    value = _.trim(value);
    if (value === '#') return '#';
    if (!(value.substr(0, 7) === 'http://' ||
         value.substr(0, 8) === 'https://' ||
         value.substr(0, 7) === 'mailto:' ||
         value[0] === '#' ||
         value[0] === '/')) {
      return '';
    }
  } else if (name === 'background') {
    // 过滤 background 属性 （这个xss漏洞较老了，可能已经不适用）
    // javascript:
    REGEXP_DEFAULT_ON_TAG_ATTR_4.lastIndex = 0;
    if (REGEXP_DEFAULT_ON_TAG_ATTR_4.test(value)) {
      return '';
    }
  } else if (name === 'style') {
    // /*注释*/
    /*REGEXP_DEFAULT_ON_TAG_ATTR_3.lastIndex = 0;
    if (REGEXP_DEFAULT_ON_TAG_ATTR_3.test(value)) {
      return '';
    }*/
    // expression()
    REGEXP_DEFAULT_ON_TAG_ATTR_7.lastIndex = 0;
    if (REGEXP_DEFAULT_ON_TAG_ATTR_7.test(value)) {
      return '';
    }
    // url()
    REGEXP_DEFAULT_ON_TAG_ATTR_8.lastIndex = 0;
    if (REGEXP_DEFAULT_ON_TAG_ATTR_8.test(value)) {
      REGEXP_DEFAULT_ON_TAG_ATTR_4.lastIndex = 0;
      if (REGEXP_DEFAULT_ON_TAG_ATTR_4.test(value)) {
        return '';
      }
    }
    value = cssFilter.process(value);
  }

  // 输出时需要转义<>"
  value = escapeAttrValue(value);
  return value;
}

// 正则表达式
var REGEXP_LT = /</g;
var REGEXP_GT = />/g;
var REGEXP_QUOTE = /"/g;
var REGEXP_QUOTE_2 = /&quot;/g;
var REGEXP_ATTR_VALUE_1 = /&#([a-zA-Z0-9]*);?/img;
var REGEXP_ATTR_VALUE_COLON = /&colon;?/img;
var REGEXP_ATTR_VALUE_NEWLINE = /&newline;?/img;
var REGEXP_DEFAULT_ON_TAG_ATTR_3 = /\/\*|\*\//mg;
var REGEXP_DEFAULT_ON_TAG_ATTR_4 = /((j\s*a\s*v\s*a|v\s*b|l\s*i\s*v\s*e)\s*s\s*c\s*r\s*i\s*p\s*t\s*|m\s*o\s*c\s*h\s*a)\:/ig;
var REGEXP_DEFAULT_ON_TAG_ATTR_5 = /^[\s"'`]*(d\s*a\s*t\s*a\s*)\:/ig;
var REGEXP_DEFAULT_ON_TAG_ATTR_6 = /^[\s"'`]*(d\s*a\s*t\s*a\s*)\:\s*image\//ig;
var REGEXP_DEFAULT_ON_TAG_ATTR_7 = /e\s*x\s*p\s*r\s*e\s*s\s*s\s*i\s*o\s*n\s*\(.*/ig;
var REGEXP_DEFAULT_ON_TAG_ATTR_8 = /u\s*r\s*l\s*\(.*/ig;

/**
 * 对双引号进行转义
 *
 * @param {String} str
 * @return {String} str
 */
function escapeQuote (str) {
  return str.replace(REGEXP_QUOTE, '&quot;');
}

/**
 * 对双引号进行转义
 *
 * @param {String} str
 * @return {String} str
 */
function unescapeQuote (str) {
  return str.replace(REGEXP_QUOTE_2, '"');
}

/**
 * 对html实体编码进行转义
 *
 * @param {String} str
 * @return {String}
 */
function escapeHtmlEntities (str) {
  return str.replace(REGEXP_ATTR_VALUE_1, function replaceUnicode (str, code) {
    return (code[0] === 'x' || code[0] === 'X')
            ? String.fromCharCode(parseInt(code.substr(1), 16))
            : String.fromCharCode(parseInt(code, 10));
  });
}

/**
 * 对html5新增的危险实体编码进行转义
 *
 * @param {String} str
 * @return {String}
 */
function escapeDangerHtml5Entities (str) {
  return str.replace(REGEXP_ATTR_VALUE_COLON, ':')
            .replace(REGEXP_ATTR_VALUE_NEWLINE, ' ');
}

/**
 * 清除不可见字符
 *
 * @param {String} str
 * @return {String}
 */
function clearNonPrintableCharacter (str) {
  var str2 = '';
  for (var i = 0, len = str.length; i < len; i++) {
    str2 += str.charCodeAt(i) < 32 ? ' ' : str.charAt(i);
  }
  return _.trim(str2);
}

/**
 * 将标签的属性值转换成一般字符，便于分析
 *
 * @param {String} str
 * @return {String}
 */
function friendlyAttrValue (str) {
  str = unescapeQuote(str);             // 双引号
  str = escapeHtmlEntities(str);         // 转换HTML实体编码
  str = escapeDangerHtml5Entities(str);  // 转换危险的HTML5新增实体编码
  str = clearNonPrintableCharacter(str); // 清除不可见字符
  return str;
}

/**
 * 转义用于输出的标签属性值
 *
 * @param {String} str
 * @return {String}
 */
function escapeAttrValue (str) {
  str = escapeQuote(str);
  str = escapeHtml(str);
  return str;
}

/**
 * 去掉不在白名单中的标签onIgnoreTag处理方法
 */
function onIgnoreTagStripAll () {
  return '';
}

/**
 * 删除标签体
 *
 * @param {array} tags 要删除的标签列表
 * @param {function} next 对不在列表中的标签的处理函数，可选
 */
function StripTagBody (tags, next) {
  if (typeof(next) !== 'function') {
    next = function () {};
  }

  var isRemoveAllTag = !Array.isArray(tags);
  function isRemoveTag (tag) {
    if (isRemoveAllTag) return true;
    return (_.indexOf(tags, tag) !== -1);
  }

  var removeList = [];   // 要删除的位置范围列表
  var posStart = false;  // 当前标签开始位置

  return {
    onIgnoreTag: function (tag, html, options) {
      if (isRemoveTag(tag)) {
        if (options.isClosing) {
          var ret = '[/removed]';
          var end = options.position + ret.length;
          removeList.push([posStart !== false ? posStart : options.position, end]);
          posStart = false;
          return ret;
        } else {
          if (!posStart) {
            posStart = options.position;
          }
          return '[removed]';
        }
      } else {
        return next(tag, html, options);
      }
    },
    remove: function (html) {
      var rethtml = '';
      var lastPos = 0;
      _.forEach(removeList, function (pos) {
        rethtml += html.slice(lastPos, pos[0]);
        lastPos = pos[1];
      });
      rethtml += html.slice(lastPos);
      return rethtml;
    }
  };
}

/**
 * 去除备注标签
 *
 * @param {String} html
 * @return {String}
 */
function stripCommentTag (html) {
  return html.replace(STRIP_COMMENT_TAG_REGEXP, '');
}
var STRIP_COMMENT_TAG_REGEXP = /<!--[\s\S]*?-->/g;

/**
 * 去除不可见字符
 *
 * @param {String} html
 * @return {String}
 */
function stripBlankChar (html) {
  var chars = html.split('');
  chars = chars.filter(function (char) {
    var c = char.charCodeAt(0);
    if (c === 127) return false;
    if (c <= 31) {
      if (c === 10 || c === 13) return true;
      return false;
    }
    return true;
  });
  return chars.join('');
}


exports.whiteList = getDefaultWhiteList();
exports.getDefaultWhiteList = getDefaultWhiteList;
exports.onTag = onTag;
exports.onIgnoreTag = onIgnoreTag;
exports.onTagAttr = onTagAttr;
exports.onIgnoreTagAttr = onIgnoreTagAttr;
exports.safeAttrValue = safeAttrValue;
exports.escapeHtml = escapeHtml;
exports.escapeQuote = escapeQuote;
exports.unescapeQuote = unescapeQuote;
exports.escapeHtmlEntities = escapeHtmlEntities;
exports.escapeDangerHtml5Entities = escapeDangerHtml5Entities;
exports.clearNonPrintableCharacter = clearNonPrintableCharacter;
exports.friendlyAttrValue = friendlyAttrValue;
exports.escapeAttrValue = escapeAttrValue;
exports.onIgnoreTagStripAll = onIgnoreTagStripAll;
exports.StripTagBody = StripTagBody;
exports.stripCommentTag = stripCommentTag;
exports.stripBlankChar = stripBlankChar;
exports.cssFilter = defaultCSSFilter;


},{"./util":4,"cssfilter":8}],2:[function(require,module,exports){
/**
 * 模块入口
 *
 * @author 老雷<leizongmin@gmail.com>
 */

var DEFAULT = require('./default');
var parser = require('./parser');
var FilterXSS = require('./xss');


/**
 * XSS过滤
 *
 * @param {String} html 要过滤的HTML代码
 * @param {Object} options 选项：whiteList, onTag, onTagAttr, onIgnoreTag, onIgnoreTagAttr, safeAttrValue, escapeHtml
 * @return {String}
 */
function filterXSS (html, options) {
  var xss = new FilterXSS(options);
  return xss.process(html);
}


// 输出
exports = module.exports = filterXSS;
exports.FilterXSS = FilterXSS;
for (var i in DEFAULT) exports[i] = DEFAULT[i];
for (var i in parser) exports[i] = parser[i];



// 在AMD下使用
if (typeof define === 'function' && define.amd) {
  define(function () {
    return module.exports;
  });
}

// 在浏览器端使用
if (typeof window !== 'undefined') {
  window.filterXSS = module.exports;
}

},{"./default":1,"./parser":3,"./xss":5}],3:[function(require,module,exports){
/**
 * 简单 HTML Parser
 *
 * @author 老雷<leizongmin@gmail.com>
 */

var _ = require('./util');

/**
 * 获取标签的名称
 *
 * @param {String} html 如：'<a hef="#">'
 * @return {String}
 */
function getTagName (html) {
  var i = html.indexOf(' ');
  if (i === -1) {
    var tagName = html.slice(1, -1);
  } else {
    var tagName = html.slice(1, i + 1);
  }
  tagName = _.trim(tagName).toLowerCase();
  if (tagName.slice(0, 1) === '/') tagName = tagName.slice(1);
  if (tagName.slice(-1) === '/') tagName = tagName.slice(0, -1);
  return tagName;
}

/**
 * 是否为闭合标签
 *
 * @param {String} html 如：'<a hef="#">'
 * @return {Boolean}
 */
function isClosing (html) {
  return (html.slice(0, 2) === '</');
}

/**
 * 分析HTML代码，调用相应的函数处理，返回处理后的HTML
 *
 * @param {String} html
 * @param {Function} onTag 处理标签的函数
 *   参数格式： function (sourcePosition, position, tag, html, isClosing)
 * @param {Function} escapeHtml 对HTML进行转义的函数
 * @return {String}
 */
function parseTag (html, onTag, escapeHtml) {
  'user strict';

  var rethtml = '';        // 待返回的HTML
  var lastPos = 0;         // 上一个标签结束位置
  var tagStart = false;    // 当前标签开始位置
  var quoteStart = false;  // 引号开始位置
  var currentPos = 0;      // 当前位置
  var len = html.length;   // HTML长度
  var currentHtml = '';    // 当前标签的HTML代码
  var currentTagName = ''; // 当前标签的名称

  // 逐个分析字符
  for (currentPos = 0; currentPos < len; currentPos++) {
    var c = html.charAt(currentPos);
    if (tagStart === false) {
      if (c === '<') {
        tagStart = currentPos;
        continue;
      }
    } else {
      if (quoteStart === false) {
        if (c === '<') {
          rethtml += escapeHtml(html.slice(lastPos, currentPos));
          tagStart = currentPos;
          lastPos = currentPos;
          continue;
        }
        if (c === '>') {
          rethtml += escapeHtml(html.slice(lastPos, tagStart));
          currentHtml = html.slice(tagStart, currentPos + 1);
          currentTagName = getTagName(currentHtml);
          rethtml += onTag(tagStart,
                           rethtml.length,
                           currentTagName,
                           currentHtml,
                           isClosing(currentHtml));
          lastPos = currentPos + 1;
          tagStart = false;
          continue;
        }
        // HTML标签内的引号仅当前一个字符是等于号时才有效
        if ((c === '"' || c === "'") && html.charAt(currentPos - 1) === '=') {
          quoteStart = c;
          continue;
        }
      } else {
        if (c === quoteStart) {
          quoteStart = false;
          continue;
        }
      }
    }
  }
  if (lastPos < html.length) {
    rethtml += escapeHtml(html.substr(lastPos));
  }

  return rethtml;
}

// 不符合属性名称规则的正则表达式
var REGEXP_ATTR_NAME = /[^a-zA-Z0-9_:\.\-]/img;

/**
 * 分析标签HTML代码，调用相应的函数处理，返回HTML
 *
 * @param {String} html 如标签'<a href="#" target="_blank">' 则为 'href="#" target="_blank"'
 * @param {Function} onAttr 处理属性值的函数
 *   函数格式： function (name, value)
 * @return {String}
 */
function parseAttr (html, onAttr) {
  'user strict';

  var lastPos = 0;        // 当前位置
  var retAttrs = [];      // 待返回的属性列表
  var tmpName = false;    // 临时属性名称
  var len = html.length;  // HTML代码长度

  function addAttr (name, value) {
    name = _.trim(name);
    name = name.replace(REGEXP_ATTR_NAME, '').toLowerCase();
    if (name.length < 1) return;
    var ret = onAttr(name, value || '');
    if (ret) retAttrs.push(ret);
  };

  // 逐个分析字符
  for (var i = 0; i < len; i++) {
    var c = html.charAt(i);
    var v, j;
    if (tmpName === false && c === '=') {
      tmpName = html.slice(lastPos, i);
      lastPos = i + 1;
      continue;
    }
    if (tmpName !== false) {
      // HTML标签内的引号仅当前一个字符是等于号时才有效
      if (i === lastPos && (c === '"' || c === "'") && html.charAt(i - 1) === '=') {
        j = html.indexOf(c, i + 1);
        if (j === -1) {
          break;
        } else {
          v = _.trim(html.slice(lastPos + 1, j));
          addAttr(tmpName, v);
          tmpName = false;
          i = j;
          lastPos = i + 1;
          continue;
        }
      }
    }
    if (c === ' ') {
      if (tmpName === false) {
        j = findNextEqual(html, i);
        if (j === -1) {
          v = _.trim(html.slice(lastPos, i));
          addAttr(v);
          tmpName = false;
          lastPos = i + 1;
          continue;
        } else {
          i = j - 1;
          continue;
        }
      } else {
        j = findBeforeEqual(html, i - 1);
        if (j === -1) {
          v = _.trim(html.slice(lastPos, i));
          v = stripQuoteWrap(v);
          addAttr(tmpName, v);
          tmpName = false;
          lastPos = i + 1;
          continue;
        } else {
          continue;
        }
      }
    }
  }

  if (lastPos < html.length) {
    if (tmpName === false) {
      addAttr(html.slice(lastPos));
    } else {
      addAttr(tmpName, stripQuoteWrap(_.trim(html.slice(lastPos))));
    }
  }

  return _.trim(retAttrs.join(' '));
}

function findNextEqual (str, i) {
  for (; i < str.length; i++) {
    var c = str[i];
    if (c === ' ') continue;
    if (c === '=') return i;
    return -1;
  }
}

function findBeforeEqual (str, i) {
  for (; i > 0; i--) {
    var c = str[i];
    if (c === ' ') continue;
    if (c === '=') return i;
    return -1;
  }
}

function isQuoteWrapString (text) {
  if ((text[0] === '"' && text[text.length - 1] === '"') ||
      (text[0] === '\'' && text[text.length - 1] === '\'')) {
    return true;
  } else {
    return false;
  }
};

function stripQuoteWrap (text) {
  if (isQuoteWrapString(text)) {
    return text.substr(1, text.length - 2);
  } else {
    return text;
  }
};


exports.parseTag = parseTag;
exports.parseAttr = parseAttr;

},{"./util":4}],4:[function(require,module,exports){
module.exports = {
  indexOf: function (arr, item) {
    var i, j;
    if (Array.prototype.indexOf) {
      return arr.indexOf(item);
    }
    for (i = 0, j = arr.length; i < j; i++) {
      if (arr[i] === item) {
        return i;
      }
    }
    return -1;
  },
  forEach: function (arr, fn, scope) {
    var i, j;
    if (Array.prototype.forEach) {
      return arr.forEach(fn, scope);
    }
    for (i = 0, j = arr.length; i < j; i++) {
      fn.call(scope, arr[i], i, arr);
    }
  },
  trim: function (str) {
    if (String.prototype.trim) {
      return str.trim();
    }
    return str.replace(/(^\s*)|(\s*$)/g, '');
  }
};

},{}],5:[function(require,module,exports){
/**
 * 过滤XSS
 *
 * @author 老雷<leizongmin@gmail.com>
 */

var FilterCSS = require('cssfilter').FilterCSS;
var DEFAULT = require('./default');
var parser = require('./parser');
var parseTag = parser.parseTag;
var parseAttr = parser.parseAttr;
var _ = require('./util');


/**
 * 返回值是否为空
 *
 * @param {Object} obj
 * @return {Boolean}
 */
function isNull (obj) {
  return (obj === undefined || obj === null);
}

/**
 * 取标签内的属性列表字符串
 *
 * @param {String} html
 * @return {Object}
 *   - {String} html
 *   - {Boolean} closing
 */
function getAttrs (html) {
  var i = html.indexOf(' ');
  if (i === -1) {
    return {
      html:    '',
      closing: (html[html.length - 2] === '/')
    };
  }
  html = _.trim(html.slice(i + 1, -1));
  var isClosing = (html[html.length - 1] === '/');
  if (isClosing) html = _.trim(html.slice(0, -1));
  return {
    html:    html,
    closing: isClosing
  };
}

/**
 * XSS过滤对象
 *
 * @param {Object} options
 *   选项：whiteList, onTag, onTagAttr, onIgnoreTag,
 *        onIgnoreTagAttr, safeAttrValue, escapeHtml
 *        stripIgnoreTagBody, allowCommentTag, stripBlankChar
 *        css{whiteList, onAttr, onIgnoreAttr}
 */
function FilterXSS (options) {
  options = options || {};

  if (options.stripIgnoreTag) {
    if (options.onIgnoreTag) {
      console.error('Notes: cannot use these two options "stripIgnoreTag" and "onIgnoreTag" at the same time');
    }
    options.onIgnoreTag = DEFAULT.onIgnoreTagStripAll;
  }

  options.whiteList = options.whiteList || DEFAULT.whiteList;
  options.onTag = options.onTag || DEFAULT.onTag;
  options.onTagAttr = options.onTagAttr || DEFAULT.onTagAttr;
  options.onIgnoreTag = options.onIgnoreTag || DEFAULT.onIgnoreTag;
  options.onIgnoreTagAttr = options.onIgnoreTagAttr || DEFAULT.onIgnoreTagAttr;
  options.safeAttrValue = options.safeAttrValue || DEFAULT.safeAttrValue;
  options.escapeHtml = options.escapeHtml || DEFAULT.escapeHtml;
  options.css = options.css || {};
  this.options = options;

  this.cssFilter = new FilterCSS(options.css);
}

/**
 * 开始处理
 *
 * @param {String} html
 * @return {String}
 */
FilterXSS.prototype.process = function (html) {
  // 兼容各种奇葩输入
  html = html || '';
  html = html.toString();
  if (!html) return '';

  var me = this;
  var options = me.options;
  var whiteList = options.whiteList;
  var onTag = options.onTag;
  var onIgnoreTag = options.onIgnoreTag;
  var onTagAttr = options.onTagAttr;
  var onIgnoreTagAttr = options.onIgnoreTagAttr;
  var safeAttrValue = options.safeAttrValue;
  var escapeHtml = options.escapeHtml;
  var cssFilter = me.cssFilter;

  // 是否清除不可见字符
  if (options.stripBlankChar) {
    html = DEFAULT.stripBlankChar(html);
  }

  // 是否禁止备注标签
  if (!options.allowCommentTag) {
    html = DEFAULT.stripCommentTag(html);
  }

  // 如果开启了stripIgnoreTagBody
  var stripIgnoreTagBody = false;
  if (options.stripIgnoreTagBody) {
    var stripIgnoreTagBody = DEFAULT.StripTagBody(options.stripIgnoreTagBody, onIgnoreTag);
    onIgnoreTag = stripIgnoreTagBody.onIgnoreTag;
  }

  var retHtml = parseTag(html, function (sourcePosition, position, tag, html, isClosing) {
    var info = {
      sourcePosition: sourcePosition,
      position:       position,
      isClosing:      isClosing,
      isWhite:        (tag in whiteList)
    };

    // 调用onTag处理
    var ret = onTag(tag, html, info);
    if (!isNull(ret)) return ret;

    // 默认标签处理方法
    if (info.isWhite) {
      // 白名单标签，解析标签属性
      // 如果是闭合标签，则不需要解析属性
      if (info.isClosing) {
        return '</' + tag + '>';
      }

      var attrs = getAttrs(html);
      var whiteAttrList = whiteList[tag];
      var attrsHtml = parseAttr(attrs.html, function (name, value) {

        // 调用onTagAttr处理
        var isWhiteAttr = (_.indexOf(whiteAttrList, name) !== -1);
        var ret = onTagAttr(tag, name, value, isWhiteAttr);
        if (!isNull(ret)) return ret;

        // 默认的属性处理方法
        if (isWhiteAttr) {
          // 白名单属性，调用safeAttrValue过滤属性值
          value = safeAttrValue(tag, name, value, cssFilter);
          if (value) {
            return name + '="' + value + '"';
          } else {
            return name;
          }
        } else {
          // 非白名单属性，调用onIgnoreTagAttr处理
          var ret = onIgnoreTagAttr(tag, name, value, isWhiteAttr);
          if (!isNull(ret)) return ret;
          return;
        }
      });

      // 构造新的标签代码
      var html = '<' + tag;
      if (attrsHtml) html += ' ' + attrsHtml;
      if (attrs.closing) html += ' /';
      html += '>';
      return html;

    } else {
      // 非白名单标签，调用onIgnoreTag处理
      var ret = onIgnoreTag(tag, html, info);
      if (!isNull(ret)) return ret;
      return escapeHtml(html);
    }

  }, escapeHtml);

  // 如果开启了stripIgnoreTagBody，需要对结果再进行处理
  if (stripIgnoreTagBody) {
    retHtml = stripIgnoreTagBody.remove(retHtml);
  }

  return retHtml;
};


module.exports = FilterXSS;

},{"./default":1,"./parser":3,"./util":4,"cssfilter":8}],6:[function(require,module,exports){
/**
 * cssfilter
 *
 * @author 老雷<leizongmin@gmail.com>
 */

var DEFAULT = require('./default');
var parseStyle = require('./parser');
var _ = require('./util');


/**
 * 返回值是否为空
 *
 * @param {Object} obj
 * @return {Boolean}
 */
function isNull (obj) {
  return (obj === undefined || obj === null);
}


/**
 * 创建CSS过滤器
 *
 * @param {Object} options
 *   - {Object} whiteList
 *   - {Object} onAttr
 *   - {Object} onIgnoreAttr
 */
function FilterCSS (options) {
  options = options || {};
  options.whiteList = options.whiteList || DEFAULT.whiteList;
  options.onAttr = options.onAttr || DEFAULT.onAttr;
  options.onIgnoreAttr = options.onIgnoreAttr || DEFAULT.onIgnoreAttr;
  this.options = options;
}

FilterCSS.prototype.process = function (css) {
  // 兼容各种奇葩输入
  css = css || '';
  css = css.toString();
  if (!css) return '';

  var me = this;
  var options = me.options;
  var whiteList = options.whiteList;
  var onAttr = options.onAttr;
  var onIgnoreAttr = options.onIgnoreAttr;

  var retCSS = parseStyle(css, function (sourcePosition, position, name, value, source) {

    var check = whiteList[name];
    var isWhite = false;
    if (check === true) isWhite = check;
    else if (typeof check === 'function') isWhite = check(value);
    else if (check instanceof RegExp) isWhite = check.test(value);
    if (isWhite !== true) isWhite = false;

    var opts = {
      position: position,
      sourcePosition: sourcePosition,
      source: source,
      isWhite: isWhite
    };

    if (isWhite) {

      var ret = onAttr(name, value, opts);
      if (isNull(ret)) {
        return name + ':' + value;
      } else {
        return ret;
      }

    } else {

      var ret = onIgnoreAttr(name, value, opts);
      if (!isNull(ret)) {
        return ret;
      }

    }
  });

  return retCSS;
};


module.exports = FilterCSS;

},{"./default":7,"./parser":9,"./util":10}],7:[function(require,module,exports){
/**
 * cssfilter
 *
 * @author 老雷<leizongmin@gmail.com>
 */

function getDefaultWhiteList () {
  // 白名单值说明：
  // true: 允许该属性
  // Function: function (val) { } 返回true表示允许该属性，其他值均表示不允许
  // RegExp: regexp.test(val) 返回true表示允许该属性，其他值均表示不允许
  // 除上面列出的值外均表示不允许
  var whiteList = {};

  whiteList['align-content'] = false; // default: auto
  whiteList['align-items'] = false; // default: auto
  whiteList['align-self'] = false; // default: auto
  whiteList['alignment-adjust'] = false; // default: auto
  whiteList['alignment-baseline'] = false; // default: baseline
  whiteList['all'] = false; // default: depending on individual properties
  whiteList['anchor-point'] = false; // default: none
  whiteList['animation'] = false; // default: depending on individual properties
  whiteList['animation-delay'] = false; // default: 0
  whiteList['animation-direction'] = false; // default: normal
  whiteList['animation-duration'] = false; // default: 0
  whiteList['animation-fill-mode'] = false; // default: none
  whiteList['animation-iteration-count'] = false; // default: 1
  whiteList['animation-name'] = false; // default: none
  whiteList['animation-play-state'] = false; // default: running
  whiteList['animation-timing-function'] = false; // default: ease
  whiteList['azimuth'] = false; // default: center
  whiteList['backface-visibility'] = false; // default: visible
  whiteList['background'] = true; // default: depending on individual properties
  whiteList['background-attachment'] = true; // default: scroll
  whiteList['background-clip'] = true; // default: border-box
  whiteList['background-color'] = true; // default: transparent
  whiteList['background-image'] = true; // default: none
  whiteList['background-origin'] = true; // default: padding-box
  whiteList['background-position'] = true; // default: 0% 0%
  whiteList['background-repeat'] = true; // default: repeat
  whiteList['background-size'] = true; // default: auto
  whiteList['baseline-shift'] = false; // default: baseline
  whiteList['binding'] = false; // default: none
  whiteList['bleed'] = false; // default: 6pt
  whiteList['bookmark-label'] = false; // default: content()
  whiteList['bookmark-level'] = false; // default: none
  whiteList['bookmark-state'] = false; // default: open
  whiteList['border'] = true; // default: depending on individual properties
  whiteList['border-bottom'] = true; // default: depending on individual properties
  whiteList['border-bottom-color'] = true; // default: current color
  whiteList['border-bottom-left-radius'] = true; // default: 0
  whiteList['border-bottom-right-radius'] = true; // default: 0
  whiteList['border-bottom-style'] = true; // default: none
  whiteList['border-bottom-width'] = true; // default: medium
  whiteList['border-collapse'] = true; // default: separate
  whiteList['border-color'] = true; // default: depending on individual properties
  whiteList['border-image'] = true; // default: none
  whiteList['border-image-outset'] = true; // default: 0
  whiteList['border-image-repeat'] = true; // default: stretch
  whiteList['border-image-slice'] = true; // default: 100%
  whiteList['border-image-source'] = true; // default: none
  whiteList['border-image-width'] = true; // default: 1
  whiteList['border-left'] = true; // default: depending on individual properties
  whiteList['border-left-color'] = true; // default: current color
  whiteList['border-left-style'] = true; // default: none
  whiteList['border-left-width'] = true; // default: medium
  whiteList['border-radius'] = true; // default: 0
  whiteList['border-right'] = true; // default: depending on individual properties
  whiteList['border-right-color'] = true; // default: current color
  whiteList['border-right-style'] = true; // default: none
  whiteList['border-right-width'] = true; // default: medium
  whiteList['border-spacing'] = true; // default: 0
  whiteList['border-style'] = true; // default: depending on individual properties
  whiteList['border-top'] = true; // default: depending on individual properties
  whiteList['border-top-color'] = true; // default: current color
  whiteList['border-top-left-radius'] = true; // default: 0
  whiteList['border-top-right-radius'] = true; // default: 0
  whiteList['border-top-style'] = true; // default: none
  whiteList['border-top-width'] = true; // default: medium
  whiteList['border-width'] = true; // default: depending on individual properties
  whiteList['bottom'] = false; // default: auto
  whiteList['box-decoration-break'] = true; // default: slice
  whiteList['box-shadow'] = true; // default: none
  whiteList['box-sizing'] = true; // default: content-box
  whiteList['box-snap'] = true; // default: none
  whiteList['box-suppress'] = true; // default: show
  whiteList['break-after'] = true; // default: auto
  whiteList['break-before'] = true; // default: auto
  whiteList['break-inside'] = true; // default: auto
  whiteList['caption-side'] = false; // default: top
  whiteList['chains'] = false; // default: none
  whiteList['clear'] = true; // default: none
  whiteList['clip'] = false; // default: auto
  whiteList['clip-path'] = false; // default: none
  whiteList['clip-rule'] = false; // default: nonzero
  whiteList['color'] = true; // default: implementation dependent
  whiteList['color-interpolation-filters'] = true; // default: auto
  whiteList['column-count'] = false; // default: auto
  whiteList['column-fill'] = false; // default: balance
  whiteList['column-gap'] = false; // default: normal
  whiteList['column-rule'] = false; // default: depending on individual properties
  whiteList['column-rule-color'] = false; // default: current color
  whiteList['column-rule-style'] = false; // default: medium
  whiteList['column-rule-width'] = false; // default: medium
  whiteList['column-span'] = false; // default: none
  whiteList['column-width'] = false; // default: auto
  whiteList['columns'] = false; // default: depending on individual properties
  whiteList['contain'] = false; // default: none
  whiteList['content'] = false; // default: normal
  whiteList['counter-increment'] = false; // default: none
  whiteList['counter-reset'] = false; // default: none
  whiteList['counter-set'] = false; // default: none
  whiteList['crop'] = false; // default: auto
  whiteList['cue'] = false; // default: depending on individual properties
  whiteList['cue-after'] = false; // default: none
  whiteList['cue-before'] = false; // default: none
  whiteList['cursor'] = false; // default: auto
  whiteList['direction'] = false; // default: ltr
  whiteList['display'] = true; // default: depending on individual properties
  whiteList['display-inside'] = true; // default: auto
  whiteList['display-list'] = true; // default: none
  whiteList['display-outside'] = true; // default: inline-level
  whiteList['dominant-baseline'] = false; // default: auto
  whiteList['elevation'] = false; // default: level
  whiteList['empty-cells'] = false; // default: show
  whiteList['filter'] = false; // default: none
  whiteList['flex'] = false; // default: depending on individual properties
  whiteList['flex-basis'] = false; // default: auto
  whiteList['flex-direction'] = false; // default: row
  whiteList['flex-flow'] = false; // default: depending on individual properties
  whiteList['flex-grow'] = false; // default: 0
  whiteList['flex-shrink'] = false; // default: 1
  whiteList['flex-wrap'] = false; // default: nowrap
  whiteList['float'] = false; // default: none
  whiteList['float-offset'] = false; // default: 0 0
  whiteList['flood-color'] = false; // default: black
  whiteList['flood-opacity'] = false; // default: 1
  whiteList['flow-from'] = false; // default: none
  whiteList['flow-into'] = false; // default: none
  whiteList['font'] = true; // default: depending on individual properties
  whiteList['font-family'] = true; // default: implementation dependent
  whiteList['font-feature-settings'] = true; // default: normal
  whiteList['font-kerning'] = true; // default: auto
  whiteList['font-language-override'] = true; // default: normal
  whiteList['font-size'] = true; // default: medium
  whiteList['font-size-adjust'] = true; // default: none
  whiteList['font-stretch'] = true; // default: normal
  whiteList['font-style'] = true; // default: normal
  whiteList['font-synthesis'] = true; // default: weight style
  whiteList['font-variant'] = true; // default: normal
  whiteList['font-variant-alternates'] = true; // default: normal
  whiteList['font-variant-caps'] = true; // default: normal
  whiteList['font-variant-east-asian'] = true; // default: normal
  whiteList['font-variant-ligatures'] = true; // default: normal
  whiteList['font-variant-numeric'] = true; // default: normal
  whiteList['font-variant-position'] = true; // default: normal
  whiteList['font-weight'] = true; // default: normal
  whiteList['grid'] = false; // default: depending on individual properties
  whiteList['grid-area'] = false; // default: depending on individual properties
  whiteList['grid-auto-columns'] = false; // default: auto
  whiteList['grid-auto-flow'] = false; // default: none
  whiteList['grid-auto-rows'] = false; // default: auto
  whiteList['grid-column'] = false; // default: depending on individual properties
  whiteList['grid-column-end'] = false; // default: auto
  whiteList['grid-column-start'] = false; // default: auto
  whiteList['grid-row'] = false; // default: depending on individual properties
  whiteList['grid-row-end'] = false; // default: auto
  whiteList['grid-row-start'] = false; // default: auto
  whiteList['grid-template'] = false; // default: depending on individual properties
  whiteList['grid-template-areas'] = false; // default: none
  whiteList['grid-template-columns'] = false; // default: none
  whiteList['grid-template-rows'] = false; // default: none
  whiteList['hanging-punctuation'] = false; // default: none
  whiteList['height'] = true; // default: auto
  whiteList['hyphens'] = false; // default: manual
  whiteList['icon'] = false; // default: auto
  whiteList['image-orientation'] = false; // default: auto
  whiteList['image-resolution'] = false; // default: normal
  whiteList['ime-mode'] = false; // default: auto
  whiteList['initial-letters'] = false; // default: normal
  whiteList['inline-box-align'] = false; // default: last
  whiteList['justify-content'] = false; // default: auto
  whiteList['justify-items'] = false; // default: auto
  whiteList['justify-self'] = false; // default: auto
  whiteList['left'] = false; // default: auto
  whiteList['letter-spacing'] = true; // default: normal
  whiteList['lighting-color'] = true; // default: white
  whiteList['line-box-contain'] = false; // default: block inline replaced
  whiteList['line-break'] = false; // default: auto
  whiteList['line-grid'] = false; // default: match-parent
  whiteList['line-height'] = false; // default: normal
  whiteList['line-snap'] = false; // default: none
  whiteList['line-stacking'] = false; // default: depending on individual properties
  whiteList['line-stacking-ruby'] = false; // default: exclude-ruby
  whiteList['line-stacking-shift'] = false; // default: consider-shifts
  whiteList['line-stacking-strategy'] = false; // default: inline-line-height
  whiteList['list-style'] = true; // default: depending on individual properties
  whiteList['list-style-image'] = true; // default: none
  whiteList['list-style-position'] = true; // default: outside
  whiteList['list-style-type'] = true; // default: disc
  whiteList['margin'] = true; // default: depending on individual properties
  whiteList['margin-bottom'] = true; // default: 0
  whiteList['margin-left'] = true; // default: 0
  whiteList['margin-right'] = true; // default: 0
  whiteList['margin-top'] = true; // default: 0
  whiteList['marker-offset'] = false; // default: auto
  whiteList['marker-side'] = false; // default: list-item
  whiteList['marks'] = false; // default: none
  whiteList['mask'] = false; // default: border-box
  whiteList['mask-box'] = false; // default: see individual properties
  whiteList['mask-box-outset'] = false; // default: 0
  whiteList['mask-box-repeat'] = false; // default: stretch
  whiteList['mask-box-slice'] = false; // default: 0 fill
  whiteList['mask-box-source'] = false; // default: none
  whiteList['mask-box-width'] = false; // default: auto
  whiteList['mask-clip'] = false; // default: border-box
  whiteList['mask-image'] = false; // default: none
  whiteList['mask-origin'] = false; // default: border-box
  whiteList['mask-position'] = false; // default: center
  whiteList['mask-repeat'] = false; // default: no-repeat
  whiteList['mask-size'] = false; // default: border-box
  whiteList['mask-source-type'] = false; // default: auto
  whiteList['mask-type'] = false; // default: luminance
  whiteList['max-height'] = true; // default: none
  whiteList['max-lines'] = false; // default: none
  whiteList['max-width'] = true; // default: none
  whiteList['min-height'] = true; // default: 0
  whiteList['min-width'] = true; // default: 0
  whiteList['move-to'] = false; // default: normal
  whiteList['nav-down'] = false; // default: auto
  whiteList['nav-index'] = false; // default: auto
  whiteList['nav-left'] = false; // default: auto
  whiteList['nav-right'] = false; // default: auto
  whiteList['nav-up'] = false; // default: auto
  whiteList['object-fit'] = false; // default: fill
  whiteList['object-position'] = false; // default: 50% 50%
  whiteList['opacity'] = false; // default: 1
  whiteList['order'] = false; // default: 0
  whiteList['orphans'] = false; // default: 2
  whiteList['outline'] = false; // default: depending on individual properties
  whiteList['outline-color'] = false; // default: invert
  whiteList['outline-offset'] = false; // default: 0
  whiteList['outline-style'] = false; // default: none
  whiteList['outline-width'] = false; // default: medium
  whiteList['overflow'] = false; // default: depending on individual properties
  whiteList['overflow-wrap'] = false; // default: normal
  whiteList['overflow-x'] = false; // default: visible
  whiteList['overflow-y'] = false; // default: visible
  whiteList['padding'] = true; // default: depending on individual properties
  whiteList['padding-bottom'] = true; // default: 0
  whiteList['padding-left'] = true; // default: 0
  whiteList['padding-right'] = true; // default: 0
  whiteList['padding-top'] = true; // default: 0
  whiteList['page'] = false; // default: auto
  whiteList['page-break-after'] = false; // default: auto
  whiteList['page-break-before'] = false; // default: auto
  whiteList['page-break-inside'] = false; // default: auto
  whiteList['page-policy'] = false; // default: start
  whiteList['pause'] = false; // default: implementation dependent
  whiteList['pause-after'] = false; // default: implementation dependent
  whiteList['pause-before'] = false; // default: implementation dependent
  whiteList['perspective'] = false; // default: none
  whiteList['perspective-origin'] = false; // default: 50% 50%
  whiteList['pitch'] = false; // default: medium
  whiteList['pitch-range'] = false; // default: 50
  whiteList['play-during'] = false; // default: auto
  whiteList['position'] = false; // default: static
  whiteList['presentation-level'] = false; // default: 0
  whiteList['quotes'] = false; // default: text
  whiteList['region-fragment'] = false; // default: auto
  whiteList['resize'] = false; // default: none
  whiteList['rest'] = false; // default: depending on individual properties
  whiteList['rest-after'] = false; // default: none
  whiteList['rest-before'] = false; // default: none
  whiteList['richness'] = false; // default: 50
  whiteList['right'] = false; // default: auto
  whiteList['rotation'] = false; // default: 0
  whiteList['rotation-point'] = false; // default: 50% 50%
  whiteList['ruby-align'] = false; // default: auto
  whiteList['ruby-merge'] = false; // default: separate
  whiteList['ruby-position'] = false; // default: before
  whiteList['shape-image-threshold'] = false; // default: 0.0
  whiteList['shape-outside'] = false; // default: none
  whiteList['shape-margin'] = false; // default: 0
  whiteList['size'] = false; // default: auto
  whiteList['speak'] = false; // default: auto
  whiteList['speak-as'] = false; // default: normal
  whiteList['speak-header'] = false; // default: once
  whiteList['speak-numeral'] = false; // default: continuous
  whiteList['speak-punctuation'] = false; // default: none
  whiteList['speech-rate'] = false; // default: medium
  whiteList['stress'] = false; // default: 50
  whiteList['string-set'] = false; // default: none
  whiteList['tab-size'] = false; // default: 8
  whiteList['table-layout'] = false; // default: auto
  whiteList['text-align'] = true; // default: start
  whiteList['text-align-last'] = true; // default: auto
  whiteList['text-combine-upright'] = true; // default: none
  whiteList['text-decoration'] = true; // default: none
  whiteList['text-decoration-color'] = true; // default: currentColor
  whiteList['text-decoration-line'] = true; // default: none
  whiteList['text-decoration-skip'] = true; // default: objects
  whiteList['text-decoration-style'] = true; // default: solid
  whiteList['text-emphasis'] = true; // default: depending on individual properties
  whiteList['text-emphasis-color'] = true; // default: currentColor
  whiteList['text-emphasis-position'] = true; // default: over right
  whiteList['text-emphasis-style'] = true; // default: none
  whiteList['text-height'] = true; // default: auto
  whiteList['text-indent'] = true; // default: 0
  whiteList['text-justify'] = true; // default: auto
  whiteList['text-orientation'] = true; // default: mixed
  whiteList['text-overflow'] = true; // default: clip
  whiteList['text-shadow'] = true; // default: none
  whiteList['text-space-collapse'] = true; // default: collapse
  whiteList['text-transform'] = true; // default: none
  whiteList['text-underline-position'] = true; // default: auto
  whiteList['text-wrap'] = true; // default: normal
  whiteList['top'] = false; // default: auto
  whiteList['transform'] = false; // default: none
  whiteList['transform-origin'] = false; // default: 50% 50% 0
  whiteList['transform-style'] = false; // default: flat
  whiteList['transition'] = false; // default: depending on individual properties
  whiteList['transition-delay'] = false; // default: 0s
  whiteList['transition-duration'] = false; // default: 0s
  whiteList['transition-property'] = false; // default: all
  whiteList['transition-timing-function'] = false; // default: ease
  whiteList['unicode-bidi'] = false; // default: normal
  whiteList['vertical-align'] = false; // default: baseline
  whiteList['visibility'] = false; // default: visible
  whiteList['voice-balance'] = false; // default: center
  whiteList['voice-duration'] = false; // default: auto
  whiteList['voice-family'] = false; // default: implementation dependent
  whiteList['voice-pitch'] = false; // default: medium
  whiteList['voice-range'] = false; // default: medium
  whiteList['voice-rate'] = false; // default: normal
  whiteList['voice-stress'] = false; // default: normal
  whiteList['voice-volume'] = false; // default: medium
  whiteList['volume'] = false; // default: medium
  whiteList['white-space'] = false; // default: normal
  whiteList['widows'] = false; // default: 2
  whiteList['width'] = true; // default: auto
  whiteList['will-change'] = false; // default: auto
  whiteList['word-break'] = true; // default: normal
  whiteList['word-spacing'] = true; // default: normal
  whiteList['word-wrap'] = true; // default: normal
  whiteList['wrap-flow'] = false; // default: auto
  whiteList['wrap-through'] = false; // default: wrap
  whiteList['writing-mode'] = false; // default: horizontal-tb
  whiteList['z-index'] = false; // default: auto

  return whiteList;
}


/**
 * 匹配到白名单上的一个属性时
 *
 * @param {String} name
 * @param {String} value
 * @param {Object} options
 * @return {String}
 */
function onAttr (name, value, options) {
  // do nothing
}

/**
 * 匹配到不在白名单上的一个属性时
 *
 * @param {String} name
 * @param {String} value
 * @param {Object} options
 * @return {String}
 */
function onIgnoreAttr (name, value, options) {
  // do nothing
}


exports.whiteList = getDefaultWhiteList();
exports.getDefaultWhiteList = getDefaultWhiteList;
exports.onAttr = onAttr;
exports.onIgnoreAttr = onIgnoreAttr;

},{}],8:[function(require,module,exports){
/**
 * cssfilter
 *
 * @author 老雷<leizongmin@gmail.com>
 */

var DEFAULT = require('./default');
var FilterCSS = require('./css');


/**
 * XSS过滤
 *
 * @param {String} css 要过滤的CSS代码
 * @param {Object} options 选项：whiteList, onAttr, onIgnoreAttr
 * @return {String}
 */
function filterCSS (html, options) {
  var xss = new FilterCSS(options);
  return xss.process(html);
}


// 输出
exports = module.exports = filterCSS;
exports.FilterCSS = FilterCSS;
for (var i in DEFAULT) exports[i] = DEFAULT[i];



// 在AMD下使用
if (typeof define === 'function' && define.amd) {
  define(function () {
    return module.exports;
  });
}

// 在浏览器端使用
if (typeof window !== 'undefined') {
  window.filterCSS = module.exports;
}

},{"./css":6,"./default":7}],9:[function(require,module,exports){
/**
 * cssfilter
 *
 * @author 老雷<leizongmin@gmail.com>
 */

var _ = require('./util');


/**
 * 解析style
 *
 * @param {String} css
 * @param {Function} onAttr 处理属性的函数
 *   参数格式： function (sourcePosition, position, name, value, source)
 * @return {String}
 */
function parseStyle (css, onAttr) {
  css = _.trimRight(css);
  if (css[css.length - 1] !== ';') css += ';';
  var cssLength = css.length;
  var isParenthesisOpen = false;
  var lastPos = 0;
  var i = 0;
  var retCSS = '';

  function addNewAttr () {
    // 如果没有正常的闭合圆括号，则直接忽略当前属性
    if (!isParenthesisOpen) {
      var source = _.trim(css.slice(lastPos, i));
      var j = source.indexOf(':');
      if (j !== -1) {
        var name = _.trim(source.slice(0, j));
        var value = _.trim(source.slice(j + 1));
        // 必须有属性名称
        if (name) {
          var ret = onAttr(lastPos, retCSS.length, name, value, source);
          if (ret) retCSS += ret + '; ';
        }
      }
    }
    lastPos = i + 1;
  }

  for (; i < cssLength; i++) {
    var c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      // 备注开始
      var j = css.indexOf('*/', i + 2);
      // 如果没有正常的备注结束，则后面的部分全部跳过
      if (j === -1) break;
      // 直接将当前位置调到备注结尾，并且初始化状态
      i = j + 1;
      lastPos = i + 1;
      isParenthesisOpen = false;
    } else if (c === '(') {
      isParenthesisOpen = true;
    } else if (c === ')') {
      isParenthesisOpen = false;
    } else if (c === ';') {
      if (isParenthesisOpen) {
        // 在圆括号里面，忽略
      } else {
        addNewAttr();
      }
    } else if (c === '\n') {
      addNewAttr();
    }
  }

  return _.trim(retCSS);
}

module.exports = parseStyle;

},{"./util":10}],10:[function(require,module,exports){
module.exports = {
  indexOf: function (arr, item) {
    var i, j;
    if (Array.prototype.indexOf) {
      return arr.indexOf(item);
    }
    for (i = 0, j = arr.length; i < j; i++) {
      if (arr[i] === item) {
        return i;
      }
    }
    return -1;
  },
  forEach: function (arr, fn, scope) {
    var i, j;
    if (Array.prototype.forEach) {
      return arr.forEach(fn, scope);
    }
    for (i = 0, j = arr.length; i < j; i++) {
      fn.call(scope, arr[i], i, arr);
    }
  },
  trim: function (str) {
    if (String.prototype.trim) {
      return str.trim();
    }
    return str.replace(/(^\s*)|(\s*$)/g, '');
  },
  trimRight: function (str) {
    if (String.prototype.trimRight) {
      return str.trimRight();
    }
    return str.replace(/(\s*$)/g, '');
  }
};

},{}]},{},[2]);
