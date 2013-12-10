using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.IO;
using Newtonsoft.Json;
using System.Configuration;

namespace AspNet
{
    public class FileUploadHandler
    {
        public event Action<FileDescriptor, bool> BeforeFileUpload;
        public event Action<FileDescriptor, bool> AfterFileUpload;
        
        public string BasePath { get; private set; }
        public string PartialPath { get; private set; }

        public FileUploadHandler() 
            : this(null, null)
        {
        }

        public FileUploadHandler(string basePath)
            : this(basePath, null)
        {
        }

        public FileUploadHandler(string basePath, string partialPath)
        {
            BasePath = basePath ?? HttpRuntime.AppDomainAppPath;
            PartialPath = partialPath ?? ConfigurationManager.AppSettings["FileUploadHandler:PartialPath"];

            try
            {
                if (!Directory.Exists(BasePath))
                    Directory.CreateDirectory(BasePath);

                if (!Directory.Exists(PartialPath))
                    Directory.CreateDirectory(PartialPath);
            }
            catch
            {
                throw;
            }
        }

        public void ProcessRequest(HttpContext context)
        {
            context.Response.AddHeader("Pragma", "no-cache");
            context.Response.AddHeader("Cache-Control", "private, no-cache");

            switch (context.Request.HttpMethod)
            {
                case "POST":
                    UploadFile(context);
                    break;
                default:
                    context.Response.ClearHeaders();
                    context.Response.StatusCode = 405;
                    break;
            }

            context.Response.End();
        }

        private void UploadFile(HttpContext context)
        {
            var results = new List<FileDescriptor>();

            int chunk = (string.IsNullOrWhiteSpace(context.Request["chunk"]) ? -1 : Convert.ToInt32(context.Request["chunk"]));
            int totalChunks = (string.IsNullOrWhiteSpace(context.Request["totalChunks"]) ? 0 : Convert.ToInt32(context.Request["totalChunks"]));
            string uid = context.Request["uid"];
            string filename = context.Request["filename"];

            if (chunk == -1)
                results.AddRange(UploadWholeFile(context, uid, filename));
            else
                results.Add(UploadPartialFile(context, uid, filename, chunk, totalChunks));

            WriteJsonResponse(context, results);
        }

        private FileDescriptor UploadPartialFile(HttpContext context, string uid, string fileName, int chunk, int totalChunks)
        {
            var fileKey = context.Request.Files.Keys[0];
            var httpFile = context.Request.Files[fileKey];
            var partialFileName = "_" + uid + "_" + fileName;
            var chunkPrefix = "C" + chunk;

            FileDescriptor descriptor = new FileDescriptor(fileKey, PartialPath, chunkPrefix + partialFileName, httpFile.ContentLength);

            using (var fs = new FileStream(descriptor.FilePath, FileMode.Append, FileAccess.Write))
            {
                var buffer = new byte[1024];
                var l = httpFile.InputStream.Read(buffer, 0, 1024);

                while (l > 0)
                {
                    fs.Write(buffer, 0, l);
                    l = httpFile.InputStream.Read(buffer, 0, 1024);
                }

                fs.Flush();
                fs.Close();
            }

            DirectoryInfo d = new DirectoryInfo(PartialPath);
            var files = d.EnumerateFiles("*" + partialFileName).OrderBy(f => f.Name);
            var size = files.Sum(f => f.Length);
            bool allChunksReceived = size == totalChunks;

            if (!allChunksReceived)
            {
                return descriptor;
            }
            else
            {
                descriptor = new FileDescriptor(fileKey, BasePath, fileName, size);
                RaiseBeforeFileUpload(descriptor, true);

                using (var fs = new FileStream(descriptor.FilePath, FileMode.Append, FileAccess.Write))
                {
                    foreach (var file in files)
                    {
                        using (var pfs = file.OpenRead())
                        {
                            var buffer = new byte[1024];
                            var l = pfs.Read(buffer, 0, 1024);

                            while (l > 0)
                            {
                                fs.Write(buffer, 0, l);
                                l = pfs.Read(buffer, 0, 1024);
                            }

                            pfs.Close();
                        }

                        file.Delete();
                    }
                    
                    fs.Flush();
                    fs.Close();
                }

                RaiseAfterFileUpload(descriptor, true);
                return descriptor;
            }
        }

        private List<FileDescriptor> UploadWholeFile(HttpContext context, string uid, string fileName)
        {
            var results = new List<FileDescriptor>();

            for (int i = 0; i < context.Request.Files.Keys.Count; i++)
            {
                var fileKey = context.Request.Files.Keys[i];
                var httpFile = context.Request.Files[fileKey];

                FileDescriptor descriptor = new FileDescriptor(fileKey, BasePath, fileName, httpFile.ContentLength);
                RaiseBeforeFileUpload(descriptor, false);

                httpFile.SaveAs(descriptor.FilePath);

                RaiseAfterFileUpload(descriptor, false);
                results.Add(descriptor);
            }

            return results;
        }

        private void WriteJsonResponse(HttpContext context, List<FileDescriptor> results)
        {
            context.Response.ContentType = "application/json";

            JsonResponse response = new JsonResponse() { Success = true, Response = new Dictionary<string, object>() };
            response.Response.Add("files", results.ToArray());

            var jsonObj = JsonConvert.SerializeObject(response);
            context.Response.Write(jsonObj);
        }

        private void RaiseBeforeFileUpload(FileDescriptor descriptor, bool partial)
        {
            if (BeforeFileUpload != null)
                BeforeFileUpload(descriptor, partial);
        }

        private void RaiseAfterFileUpload(FileDescriptor descriptor, bool partial)
        {
            if (AfterFileUpload != null)
                AfterFileUpload(descriptor, partial);
        }

        public class FileDescriptor
        {
            public FileDescriptor(string key, string basePath, string fileName, long size)
            {
                Key = key;
                Name = fileName;
                FilePath = Path.Combine(basePath, fileName);
                Size = size;
            }

            public string Key { get; private set; }
            public string Name { get; set; }
            public string FilePath { get; set; }
            public long Size { get; set; }
        }
    }
}