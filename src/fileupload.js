(function ($) {
    var fu = window.fileupload || {};
    window.fileupload = fu;

    fu.fileEx = (function () {
        function upload(url, options) {
            var o = $.extend({
                key: this.name,
                extras: {},
                chunk: true,
                chunkSize: (1024 * 500), // 500KB
                maxParallelChunks: 1,
                maxRetry: 0
            }, options);

            o.chunkSize = (o.chunkSize > 0 ? o.chunkSize : 1024 * 500);
            o.maxParallelChunks = (o.maxParallelChunks > 0 ? o.maxParallelChunks : 1);

            return makeUpload(url, this, o);
        };

        function abort() {
            for (var i = 0; i < this.xhrs.length; i++) {
                this.xhrs[i].abort();
            }
        };

        function generatePreview() {
			var self = this;
            var promise = $.Deferred();
			var objectURL = window.URL || window.webkitURL;
			var type = (self.type.indexOf('image/') === 0 ? 'image' : (self.type.indexOf('video/') === 0 ? 'video' : null));
			
			if(!type) {
				promise.reject('error');
			} else if(objectURL && self.getSource) {
				setTimeout(function() {					
					var preview = new String(objectURL.createObjectURL(self.getSource()));
					preview.release = function() { objectURL.revokeObjectURL(this); };
					
					if(type === 'video') {
						generateVideoPoster(preview).done(function(preview) {
							if(preview)
								promise.resolve('success', preview);
							else
								promise.reject('error');
						}).fail(function() {
							promise.reject('error');
						});
					} else {
						promise.resolve('success', preview);
					}
				}, 1);
			} else if (self.size > (1024 * 1024 * 7)) {
                promise.reject('maxSize');
			} else if(type === 'video') {
				promise.reject('error');
			} else {
				var reader = new mOxie.FileReader();

				reader.onabort = function () { promise.reject('aborted'); };
				reader.onerror = function () { promise.reject('error', reader.error); };
				reader.onprogress = function (e) { promise.notify(e); };
				reader.onload = function () { 
					var preview = new String(reader.result);
					preview.release = function() { };
					promise.resolve('success', preview);
				};
				
				reader.readAsDataURL(self);
				setTimeout(function() { promise.reject('error'); }, 10000);
            }

            return promise.promise();
        }
		
		function generateVideoPoster(preview) {
			var canvas = document.createElement('canvas');
			var context = (canvas.getContext && canvas.getContext('2d'));
			if(!context) return null;
			
			var video = document.createElement('video');
			if(!video.canPlayType) return null;
			
			var promise = $.Deferred();
			
			video.src = preview;
			video.addEventListener('loadeddata', function() {
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

				var dataUrl = new String(context.canvas.toDataURL('image/png'));
				dataUrl.release = function() { };
				
				promise.resolve(dataUrl);
			});
			
			setTimeout(function() { promise.reject('error'); }, 10000);
			return promise.promise();
		}

        function makeUpload(url, file, options) {
            var promise;
            var uid = mOxie.guid();
            file.progress = { loaded: 0, total: file.size, chunks: {} };
            file.xhrs = [];

            if (!options.chunk) {
                promise = uploadChunk(uid, url, file, options);
            } else {
                var totalChunks = Math.ceil(file.size / options.chunkSize);
                var chain = null;
                var chunk = 0;

                while (chunk < totalChunks) {
                    if (!chain) {
                        chain = parallelizeChunks(uid, url, file, options, chunk, totalChunks);
                    } else {
                        chain = chain.then(function () {
                            var args = arguments[arguments.length - 1];
                            args = ($.isArray(args) ? args[1] : args);
                            return parallelizeChunks(args.uid, args.url, args.file, args.options, args.chunk + 1, totalChunks);
                        });
                    }

                    chunk += options.maxParallelChunks;
                }

                promise = chain;
            }

            return promise;
        }

        function parallelizeChunks(uid, url, file, options, chunk, totalChunks) {
            var promises = [];

            for (var i = 0; i < options.maxParallelChunks && chunk < totalChunks; i++) {
                promises.push(uploadChunk(uid, url, file, options, chunk, totalChunks));
                chunk++;
            }

            return $.when.apply($, promises);
        }

        function uploadChunk(uid, url, file, options, chunk, totalChunks) {
            options = $.extend({}, options);

            var args = { uid: uid, url: url, file: file, options: options, chunk: chunk, totalChunks: totalChunks };
            var promise = $.Deferred();
            var fileToSend = file;

            options.extras.uid = uid;
            options.extras.filename = file.name;

            if (chunk !== undefined) {
                var start = chunk * options.chunkSize;
                var end = start + options.chunkSize;
                fileToSend = fileToSend.slice(start, end);

                options.extras.chunk = chunk;
                options.extras.totalChunks = totalChunks;
            }

            var xhr = new mOxie.XMLHttpRequest();
            file.xhrs.push(xhr);

            xhr.onerror = function (e) { promise.reject(e, args); };
            xhr.onabort = function (e) { promise.reject(e, args); };

            xhr.upload.onprogress = function (e) {
                file.progress.chunks[chunk] = e;
                file.progress.loaded = 0;
                for (var k in file.progress.chunks) {
                    file.progress.loaded += file.progress.chunks[k].loaded;
                }

                promise.notify(file.progress, args);
            };

            xhr.onload = function (e) {
                args.serverResponse = { status: xhr.status, responseText: xhr.responseText };

                if (xhr.status === 200)
                    promise.resolve(e, args);
                else
                    promise.reject(e, args);
            };

            xhr.open('POST', url, true);
            xhr.send(prepareFormData(fileToSend, options.key, options.extras));

            var ret = promise.promise();

            if (options.retry > 0) {
                ret = ret.then(null, function (e, args) {
                    args.retry = args.retry - 1;
                    args.extras.retry = true;
                    return uploadChunk(args.uid, args.url, args.file, args.options, args.chunk, args.totalChunks);
                });
            }

            return ret;
        }

        function prepareFormData(file, key, extras) {
            var formData = new mOxie.FormData();
            formData.append(key, file);

            for (var k in extras) {
                if (extras[k] !== null && extras[k] !== undefined)
                    formData.append(k, extras[k]);
            }

            return formData;
        }

        return function (file) {
            file.upload = upload;
            file.abort = abort;
            file.generatePreview = generatePreview;
            return file;
        };
    } ());

    fu.uploadQueue = function (options) {
        var self = this;
        var queue = {};
        var publicQueue = null;
        var status = 'waiting';

        self.options = $.extend({}, options);

        self.addFile = function (key, file, options) {
            if (!key || key.lenght === 0) {
                warn('operation cancelled - parameter "key" is required to add a file');
                return;
            }

            if (queue[key]) {
                warn('operation cancelled - key ' + key + ' was already added to the queue');
                return;
            }

            options = options || {};
            options.extras = $.extend({}, self.options.extras, options.extras);
            options.key = key;

            var item = { key: key, file: file, options: options, status: 'waiting' };
            queue[key] = item;
            publicQueue = null;

            $(self).trigger('fileAdded', item);
        };

        self.removeFile = function (key) {
            var item = queue[key];

            if (item && item.status !== 'waiting') {
                warn('operation cancelled - file cannot be removed because it is already uploading');
                return;
            }

            if (item) {
                delete queue[key];
                publicQueue = null;

                $(self).trigger('fileRemoved', item);
            }
        };

        self.removeAll = function () {
            for (var k in queue) {
                if (queue[k].status === 'waiting') {
                    var item = queue[k];
                    delete queue[k];
                    $(self).trigger('fileRemoved', item);
                }
            }

            publicQueue = null;
        };

        self.getCount = function () {
            var size = 0;

            for (var key in queue)
                if (queue.hasOwnProperty(key)) size++;

            return size;
        };

        self.getItems = function () {
            if (!publicQueue) {
                var item;
                publicQueue = [];

                for (var key in queue) {
                    item = JSON.parse(JSON.stringify(queue[key]));
                    delete item.status;
                    publicQueue.push(item);
                }
            }

            return publicQueue;
        }

        self.getItem = function (key) {
            if (queue[key]) {
                item = JSON.parse(JSON.stringify(queue[key]));
                delete item.status;
                return item;
            } else {
                return null;
            }
        };

        self.containsKey = function (key) {
            return (queue[key] ? true : false);
        };

        self.upload = function (url, key) {
            if (status !== 'waiting') {
                warn('operation cancelled - queue is already uploading');
                return;
            }

            var promise;
            var promises = [];
            var uploadProgress = { files: {}, total: 0, loaded: 0 };

            $(self).trigger('uploadStarted');
            status = 'uploading';

            if (key && queue[key]) {
                var item = queue[key];

                if (item.status === 'waiting') {
                    uploadProgress.total += item.file.size;

                    promise = item.file.upload(url || self.options.url, item.options);
                    $(self).trigger('fileSent', item);

                    promises.push(promise);
                    attachFilePromiseCallbacks(promise);

                    item.status = 'uploading';
                }
            } else {
                for (var key in queue) {
                    var item = queue[key];

                    if (item.status === 'waiting') {
                        uploadProgress.total += item.file.size;

                        promise = item.file.upload(url || self.options.url, item.options);
                        $(self).trigger('fileSent', item);

                        promises.push(promise);
                        attachFilePromiseCallbacks(promise);

                        item.status = 'uploading';
                    }
                }
            }

            if (promises.length > 0) {
                var ret = $.when.apply($, promises);
                attachQueuePromiseCallbacks(ret, uploadProgress);
                return ret;
            } else {
                var ret = $.Deferred();
                attachQueuePromiseCallbacks(ret, uploadProgress);

                ret.resolve();
                return ret.promise();
            }
        };

        self.abortUpload = function (key) {
            if (key && queue[key]) {
                var item = queue[key];

                if (item.status === 'uploading') {
                    item.file.abort();
                    item.status = 'waiting';
                }
            } else {
                for (var key in queue) {
                    var item = queue[key];

                    if (item.status === 'uploading') {
                        item.file.abort();
                        item.status = 'waiting';
                    }
                }
            }
        };

        self.on = function () {
            var $self = $(self);
            $self.on.apply($self, arguments);
            return self;
        };

        self.off = function () {
            var $self = $(self);
            $self.off.apply($self, arguments);
            return self;
        };

        function attachFilePromiseCallbacks(promise) {
            promise.always(function (e, args) {
                var item = queue[args.options.key];
                $(self).trigger('fileProgress', [{ total: item.file.size, loaded: item.file.size }, item]);
                $(self).trigger('fileFinished', item);
            });

            promise.fail(function (e, args) {
                var item = queue[args.options.key];
                delete queue[args.options.key];
                publicQueue = null;

                $(self).trigger('fileFailed', item);
            });

            promise.done(function (e, args) {
                var item = queue[args.options.key];
                delete queue[args.options.key];
                publicQueue = null;

                $(self).trigger('fileDone', item);
            });

            promise.progress(function (e, args) {
                var item = queue[args.options.key];
                $(self).trigger('fileProgress', [e, item]);
            });
        }

        function attachQueuePromiseCallbacks(promise, progress) {
            promise.always(function () {
                progress.loaded = progress.total;
                $(self).trigger('uploadProgress', progress);
                $(self).trigger('uploadFinished');

                status = 'waiting';
            });

            promise.progress(function () {
                for (var i = 0; i < arguments.length; i++) {
                    if (!arguments[i])
                        continue;

                    var p, o;

                    if ($.isArray(arguments[i])) {
                        p = arguments[i][0];
                        o = arguments[i][1].options;
                    } else {
                        p = arguments[0];
                        o = arguments[1].options;
                    }

                    progress.files[o.key] = p;
                }

                var loaded = 0;
                for (var f in progress.files) {
                    loaded += progress.files[f].loaded;
                }

                progress.loaded = loaded;
                $(self).trigger('uploadProgress', progress);
            });
        }

        function warn(message) {
            if (console && console.warn)
                console.warn(message);
        }
    };

    fu.setFlashRuntimePath = function (path) {
        mOxie.Env.swf_url = path;
    };

    $.fn.fileInput = function (options) {
        this.each(function () {
            var element = $(this);

            var o = $.extend({}, options);
            o.browse_button = this;

            var self = new mOxie.FileInput(o);
            self.onready = function (e) { element.trigger('ready', e); };
            self.onrefresh = function (e) { element.trigger('refresh', e); };
            self.onchange = changed;
            self.onmouseenter = mouseEnter;
            self.onmouseleave = mouseLeave;
            self.onmousedown = mouseDown;
            self.onmouseup = mouseUp;

            self.init();

            function changed(e) {
                for (var i = 0; i < e.target.files.length; i++) {
                    fileupload.fileEx(e.target.files[i]);
                }

                element.trigger('change', [e.target.files]);
            }
			
			function mouseEnter(e) { 
				element.addClass('hover');
				element.trigger('mouseenter', e); 
			}
			
			function mouseLeave(e) { 
				element.removeClass('hover');
				element.trigger('mouseleave', e); 
			}
			
			function mouseDown(e) { 
				element.addClass('pressed');
				element.trigger('mousedown', e); 
			}
			
			function mouseUp(e) { 
				element.removeClass('pressed');
				element.trigger('mouseup', e); 
			}
        });

        return this;
    };
} (jQuery));