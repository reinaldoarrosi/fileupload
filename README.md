#fileupload
This project main focus is to create an EASY to use API to pick files and upload them using ajax requests. 
This project is compatible with IE 7+, Firefox 2+, Chrome, Safari, Opera and pretty much every other major browser thanks to the amazing moxie (https://github.com/moxiecode/moxie) which provides shims to the HTML5 File API by using Flash in older browsers.

##Dependencies
fileupload depends on jQuery (1.8+ - http://www.jquery.com) and moxie (https://github.com/moxiecode/moxie).
<br>
You can get jQuery directly from their website
<br>
As for moxie, we provide a precompiled version of moxie's js and SWF files in the 'moxie' folder, but please notice that these precompiled versions are probably not the latest ones so feel free to get the latest version at https://github.com/moxiecode/moxie

##Building
There is no building ;D<br>
Really, besides the dependencies the only thing you need is the fileupload.js. We do not provide a minified version of it (it's just 15KB, or 3KB gziped), but if you really want to save some bandwidth you can easily minify it at http://refresh-sf.com/yui/

##Usage
To use file upload you'll need to do 4 things:
- Add a reference to jQuery
- Add a reference to moxie
- Add a reference to fileupload
- Configure the path to the SWF file so that moxie can work on older browsers (optional if you don't need this kind of support)

###Configuring the SWF path
To set the path to the SWF file you can use one of two ways:

    fileupload.setFlashRuntimePath('path/to/the/swf/file.swf');

or

    mOxie.Env.swf_url = 'path/to/the/swf/file.swf';
    
Both will do the exact same thing, but I do prefer the first way cause it looks 'cleaner' ;D

## Example
I think the easiest way to get started with fileupload is to clone this repository and open example.html in the sample folder.<br>
There you'll find a sample page with all the references already in place and commented source code to that shows the most common use cases for this project.<br>
There is also an ASP.NET server-side upload handler implementation in src/server/AspNet.FileUploadHandler.cs<br>

##Components
This project contains 3 distinct components that are build on top of moxie and jQuery
- A function called fileupload.FileEx that adds 3 new methods (upload, abort, generatePreview) to the mOxie.File class
- A jQuery plugin to create a file picker 'button' that allows the user to select files to upload (depends on fileupload.FileEx)
- A fileupload.uploadQueue class to create an upload queue that can manage uploading multiple files and reporting upload progress, completion, failure, etc...

## fileupload.FileEx(file)
This functions receives a file (HTML API File or mOxie.File) and ADDS 3 methods to the file instance:
####upload(url, [options])
Uploads the file to the given _url_<br>
__Returns__: a PROMISE where callbacks can be attached<br>

__promise callbacks__<br>
The promise returned by the upload method can have the done, fail, always and progress callbacks attached to it, by using the same syntax used in jQuery's promises (.done, .fail, .always and .progress)<br><br>
These are the callback signatures:<br>
_progress_ = function(progress, item)
- progress: an object with total and loaded properties representing the upload progress (see progress status)
- item: an object with the following properties
    - chunk: the chunk being uploaded
    - file: the file being uploaded
    - options: the options used for the upload
    - serverResponse: and object which contains the server response. this object has the following properties
        - status: the http status returned by the server
        - responseText: the response from the server in text format
    - totalChunks: the number of chunks the file was splitted into
    - uid: the unique upload id
    - url: the url where the file is being sent

_done, fail and always_ = function(e, item)
- e: event info
- item: the same as described in the _progress_ callback

<table>
<tr><th>Parameter</th><th>Description</th><th>Required</th></tr>
<tr><td>url</td><td>url to where the file will be uploaded</td><td>yes</td></tr>
<tr><td>options</td>
<td>
<br><br>
<table>
<tr><th>name</th><th>description</th><th>default</th></tr>
<tr><td>key(string)</td><td>key used to identify the file on server side (similar to the name property on an input type="file")</td><td>the name of the file on disk</td></tr>
<tr><td>chunk(bool)</td><td>enables chunking (sends the file in small pieces to the server)</td><td>true</td></tr>
<tr><td>chunkSize(int)</td><td>the size of each chunk in bytes</td><td>512000 bytes (500KB)</td></tr>
<tr><td>maxParallelChunks(int)</td><td>maximum number of chunks that can be sent at the same time to the server. for instance, if maxParallelChunks is 3 and the file was splitted into 8 chunks the first 3 chunks will be sent, when ALL 3 chunks complete the next 3 will be sent and so on</td><td>1 (equivalent to NO parallelization)</td></tr>
<tr><td>maxRetry(int)</td><td>sets the number of times a chunk will retry to upload itself after a failure. if a failure occurs in every try the upload will be aborted and considered as failed</td><td>0 (equivalent to NO RETRYING)</td></tr>
<tr><td>extras(object)</td><td>sets an object in a 'key-value' format that will be sent to the server in addition to file being uploaded. these values appears as POST variable to the server</td><td>0 (equivalent to NO RETRYING)</td></tr>
</table>
</td>
<td>no</td></tr>
</table>

####abort()
Cancels the upload<br>
__Returns__: nothing

####generatePreview()
Try to generate a preview of the file by creating using window.URL.createObjectURL. <br>
__IMPORTANT__: If createObjectURL is not supported previews won't be generated and the promise will be rejected with status 'error'.<br>
If previews does not finish generating within 10 seconds the promise will be rejected with status 'aborted'.
__Returns__: a PROMISE where callbacks can be attached<br>

__promise callbacks__<br>
_progress_ = function(progress)
- progress: an object with total and loaded properties representing the upload progress (see progress status)

_done, fail and always_ = function(status, preview)
- status: either 'success', 'error' or 'aborted' depending on what happened during generation.
- preview: a String object that represents either the URLObject or dataURL. This String has a release method used to release resources used by the preview (this method has effect only when the preview is a URLObject and is the same as calling _window.URL.revokeObjectURL_)

## jQuery.fileinput([options])
This is the jQuery plugin that can be used to transform any DOM element into a 'button' that when clicked will open a file selection dialog (like an input type="file").<br>
Moxie creates an element on top of the real element to be able to open file selection dialogs when a click happens. This can make some browser lose the ability to style :hover and :active css. To make it easier to deal with this scenario the 'hover' and 'pressed' css classes is added/removed to the element accordingly. <br>
Usage is similar to other jQuery plugins:
   
    ...
    <button type="button" id="btnFilePicker">Choose a file...</button>
    ...
    <script type="text/javascript">
        $('#btnFilePicker').fileinput({
            multiple: false,
            accept: []
        });
    </script>
    
<table>
<tr><th>option</th><th>description</th><th>default</th></tr>
<tr><td>multiple(bool)</td><td>allows the user to select multiple files from the file selection dialog</td><td>false</td></tr>
<tr><td>accept(array)</td><td>filters which file extensions will be allowed by the file selection dialog. this parameter is an array and each item must be in the format _{ title: 'title to display in dialog', extensions: 'jpg,png,bmp' }_ </td><td>[] (accepts any extension)</td></tr>
</table>

###events
To subscribe to events use jQuery's .on method
<br>
<table>
<tr><th>event</th><th>description</th><th>arguments</th></tr>
<tr><td>ready(e)</td><td>triggered when the file input is ready to be used</td><td>e = event info</td></tr>
<tr><td>change(e, f)</td><td>triggered when a file selection is made</td><td>e = event info<br>f = selected files array (these files are pre-processed by fileupload.FileEx so they already have the 3 additional methods explained earlier)</td></tr>
<tr><td>mouseenter(e)</td><td>triggered when the mouse cursor hover over the file picker</td><td>e = event info</td></tr>
<tr><td>mouseleave(e)</td><td>triggered when the mouse cursor stops hovering over the file picker</td><td>e = event info</td></tr>
<tr><td>mousedown(e)</td><td>triggered when the mouse buton is pressed over the file picker</td><td>e = event info</td></tr>
<tr><td>mouseup(e)</td><td>triggered when the mouse buton is released over the file picker</td><td>e = event info</td></tr>
</table>

##fileupload.uploadQueue([options])

This class can be used to control uploading multiple files to the server.
<table>
<tr><th>options</th><th>description</th><th>default</th></tr>
<tr><td>url(string)</td><td>default url to use when uploading files</td><td>null (no default URL)</td></tr>
<tr><td>extras(object)</td><td>object in a 'key-value' format that will be sent to the server for EVERY file being uploaded by the uploadQueue. see fileupload.FileEx.upload parameters for more info</td></tr>
</table>

###methods

####addFile(key, file, [options])
Adds a file to the queue. Parameter 'options' is the same as the one used in fileupload.FileEx.upload method.<br>
__Returns__: nothing

####removeFile(key)
Removes the item with the given key from the queue if it is NOT being uploaded<br>
__Returns__: nothing

####removeAll()
Removes all items from the queue that are NOT being uploaded<br>
__Returns__: nothing

####getCount()
__Returns__: The number of items in the queue

####getItems()
__Returns__: An array with a COPY of all the items in the queue

####getItem(key)
__Returns__: A COPY of the item if found, null otherwise

####containsKey(key)
__Returns__: true if the key is present, false otherwise

####upload([url], [key])
If key is provided uploads the file with the given key to the server. If key is not provided uploads all files in the queue to the server.<br>
If url is not provided the files will be sent to options.url (the default url for the queue).<br>
__Returns__: a PROMISE where callbacks can be attached

__promise callbacks__<br>
The promise returned by the upload method can have the done, fail, always and progress callbacks attached to it, by using the same syntax used in jQuery's promises (.done, .fail, .always and .progress)<br>
The promise will end successfully if all uploads are successful, will fail if any upload fails.<br>
Altough it is possible to add these callbacks to the promise it's far easier to use the queue events (see below) since these will have arguments that have already been pre-processed.

####abortUpload([key])
If a key is provided aborts the upload for the file with that key. If a key is not provided abort all current uploads.<br>
__Returns__: nothing

####on()
Use this method to subscribe to events raised by the uploadQueue. Internally this method calls jQuery.on upon the uploadQueue, which means that the parameters for these methods are exactly the same as jQuery's .on method.

####off()
Use this method to unsubscribe to events raised by the uploadQueue. Internally this method calls jQuery.off upon the uploadQueue, which means that the parameters for these methods are exactly the same as jQuery's .off method.

###events
To subscribe and unsubscribe to events use queue.on and queue.off. The syntax is similar to jQuery's .on and .off methods.
<table>
<tr><th>event</th><th>description</th><th>arguments</th></tr>
<tr><td>fileAdded(e, i)</td><td>triggered when a file is added to the queue</td><td>e = event info<br>i = queue item (see below)</td></tr>
<tr><td>fileRemoved(e, i)</td><td>triggered when a file is removed from the queue</td><td>e = event info<br>i = queue item (see below)</td></tr>
<tr><td>uploadStarted(e)</td><td>triggered when queue starts uploading</td><td>e = event info</td></tr>
<tr><td>uploadProgress(e, p)</td><td>triggered to indicate queue progress (this is the general progress, for file-specific progress see fileProgress)</td><td>e = event info<br>p = progress status (see below)</td></tr>
<tr><td>uploadFinished(e)</td><td>triggered when queue finishes uploading</td><td>e = event info</td></tr>
<tr><td>fileSent(e, i)</td><td>triggered when a file starts uploading</td><td>e = event info<br>i = queue item (see below)</td></tr>
<tr><td>fileProgress(e, p, i)</td><td>triggered to indicate file upload progress</td><td>e = event info<br>p = progress status (see below)<br>i = queue item (see below)</td></tr>
<tr><td>fileDone(e, i)</td><td>triggered when a file was successfully uploaded</td><td>e = event info<br>i = queue item (see below)</td></tr>
<tr><td>fileFailed(e, i)</td><td>triggered when a file failed to upload</td><td>e = event info<br>i = queue item (see below)</td></tr>
<tr><td>fileFinished(e, i)</td><td>triggered when a file finishes uploading (either when upload was sucessful or not)</td><td>e = event info<br>i = queue item (see below)</td></tr>
</table>

####queue item
The queue item represents a file that has been enqueued and has the following properties:
- key: the key of this item in the queue
- file: the file that was enqueued
- options: the options passed to the _addFile_ method

####progress status
The progress status has the following properties:
- total: the total size that will be uploaded in bytes
- loaded: the amount of bytes that were already uploaded

##Server-side upload handler
When you upload file to the server some extra information goes along with the file itself so that you can handle partial uploads (chunking).
The server-side upload handler is pretty straightforward: everything is sent as a standard multipart POST, which means that your web framework of choice 
probably already parses the request into a more manageable format. <br>
To simplify handling uploads each request that is made to the server contains a single file or chunk, even when uploading from an _fileupload.uploadQueue_ or
using the 'multiple' option on _jQuery.fileInput_.
<br><br>
As said earlier in src/server/AspNet.FileUploadHandler.cs you'll find a C# implementation of a server-side upload handler for reference.

### Variables
There are 2 variables that are always sent (using chunking or not):
- filename: this contains the name of the file that is being sent. generally the filename can be obtained directly, but when using chunking we lose the filename (it will be 'blob'), so to make thing simple we always send the original filename to the server in this variable
- uid: this is a unique upload identifier (UUID). this is used to diferentiate sequential uploads of the same file and also assists in handling chunked uploads
<br><br>
When using chunking is importante to notice that chunks will arrive as if they were regular files and that chunks can arrive out-of-order.
Because you need to know if you're receiving a chunk or not and also the exact order you must rearrange these chunks in order to rebuild the file on server, there are 2 more variables that are sent when chunking:
- chunk: this is the chunk number. the chunk number is used to define the order in which chunks must be arranged to reasemble the file on server
- totalChunks: this indicates the number of chunks that compose the file being uploaded. this information together with the uid can be used to determinate if all chunks were received, so that the file can be reassembled

### Server response
The server can respond to an upload with anything it wants. Upload success or failure is based on the http status of the response (200 = success, anything else = failure). You can access the server response from the serverResponse object that is an argument received by the promises callbacks

##License
This project is released under the "clone this repository and do whatever you want with it" license ;D