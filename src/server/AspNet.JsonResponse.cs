using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Newtonsoft.Json;

namespace AspNet
{
    public class JsonResponse
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; }
        public Dictionary<string, object> Response { get; set; }

        public static void SendJSONResponse<T>(T obj, bool respondAsServerError = false)
        {
            string json;
            HttpResponse response = HttpContext.Current.Response;

            if (obj as string == null)
                json = ToJSON(obj);
            else
                json = obj as string;

            if (respondAsServerError)
            {
                response.TrySkipIisCustomErrors = true;
                response.StatusCode = 500;
            }

            response.ClearContent();
            response.ContentType = "application/json";
            response.Write(json);
            response.End();
        }

        private static string ToJSON(object obj)
        {
            return JsonConvert.SerializeObject(obj);
        }
    }
}