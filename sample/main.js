$(function () {
    fileupload.setFlashRuntimePath("Scripts/Moxie.swf");
    var queue = new fileupload.uploadQueue({
        extras: { upload: true }
    });

    queue.on('uploadStarted uploadProgress uploadFinished fileAdded fileRemoved fileSent fileProgress fileDone fileFailed fileFinished', function (e, p) {
        if (e.type === 'fileAdded') {
            p.file.generatePreview().always(function (status, arg) {
                if (status === 'success')
                    $("#lsTeste").append('<li id="' + p.key + '"><img src="' + arg + '" style="width: 100px; height: 100px" />' + p.file.name + '</li>');
                else if (status === 'maxSize')
                    $("#lsTeste").append('<li id="' + p.key + '">' + p.file.name + '</li>');
            });
        } else if (e.type === 'fileRemoved' || e.type === 'fileFinished') {
            $("#lsTeste #" + p.key).remove();
        }
    });

    $('#btnFilePicker').fileInput().on('change', function (e, d) {
        var f = d[0];
        queue.addFile('teste' + queue.getCount(), f);
    });

    $('#btnAjax').click(function () {
        queue.upload('Default.aspx');
    });
});