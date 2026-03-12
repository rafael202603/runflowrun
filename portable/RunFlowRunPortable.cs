using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;

internal static class RunFlowRunPortable
{
  private sealed class Options
  {
    public bool NoBrowser;
    public bool Headless;
    public int? Port;
    public int? DurationMs;
    public string WriteUrlPath;
  }

  private sealed class EmbeddedServer : IDisposable
  {
    private readonly TcpListener _listener;
    private readonly Dictionary<string, string> _resources;
    private readonly Thread _thread;
    private volatile bool _running;

    public EmbeddedServer(int? preferredPort)
    {
      var port = preferredPort ?? FindFreePort();
      Url = "http://127.0.0.1:" + port.ToString(CultureInfo.InvariantCulture) + "/";
      _listener = new TcpListener(IPAddress.Loopback, port);
      _resources = LoadResourceMap();
      _thread = new Thread(ListenLoop);
      _thread.IsBackground = true;
    }

    public string Url { get; private set; }

    public void Start()
    {
      _running = true;
      _listener.Start();
      _thread.Start();
    }

    public void Dispose()
    {
      _running = false;
      try
      {
        _listener.Stop();
      }
      catch
      {
      }
    }

    private void ListenLoop()
    {
      while (_running)
      {
        TcpClient client = null;
        try
        {
          client = _listener.AcceptTcpClient();
        }
        catch
        {
          if (!_running) return;
        }

        if (client == null) continue;

        try
        {
          Serve(client);
        }
        catch
        {
          try
          {
            client.Close();
          }
          catch
          {
          }
        }
      }
    }

    private void Serve(TcpClient client)
    {
      using (client)
      {
        client.ReceiveTimeout = 3000;
        client.SendTimeout = 3000;
        using (var stream = client.GetStream())
        {
          var requestPath = ReadRequestPath(stream);
          if (requestPath == null)
          {
            TryWriteResponse(stream, 400, "Solicitud invalida.");
            return;
          }

          var path = Uri.UnescapeDataString(requestPath).TrimStart('/');
          path = path.Replace('\\', '/');
          if (string.IsNullOrEmpty(path)) path = "index.html";

          var resourceName = "dist/" + path;
          if (!_resources.ContainsKey(resourceName))
          {
            if (!HasExtension(path))
            {
              resourceName = "dist/index.html";
            }
            else
            {
              TryWriteResponse(stream, 404, "Archivo no encontrado.");
              return;
            }
          }

          using (var resourceStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName))
          {
            if (resourceStream == null)
            {
              TryWriteResponse(stream, 404, "Recurso no encontrado.");
              return;
            }

            var buffer = ReadAllBytes(resourceStream);
            WriteHttpResponse(stream, 200, "OK", GetContentType(resourceName), buffer);
          }
        }
      }
    }

    private static Dictionary<string, string> LoadResourceMap()
    {
      var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
      foreach (var name in Assembly.GetExecutingAssembly().GetManifestResourceNames())
      {
        if (name.StartsWith("dist/", StringComparison.OrdinalIgnoreCase))
        {
          result[name] = name;
        }
      }

      return result;
    }

    private static byte[] ReadAllBytes(Stream stream)
    {
      using (var memory = new MemoryStream())
      {
        stream.CopyTo(memory);
        return memory.ToArray();
      }
    }

    private static bool HasExtension(string path)
    {
      var fileName = Path.GetFileName(path);
      return fileName.IndexOf('.') >= 0;
    }

    private static int FindFreePort()
    {
      var listener = new TcpListener(IPAddress.Loopback, 0);
      listener.Start();
      var port = ((IPEndPoint)listener.LocalEndpoint).Port;
      listener.Stop();
      return port;
    }

    private static string ReadRequestPath(NetworkStream stream)
    {
      using (var memory = new MemoryStream())
      {
        var buffer = new byte[1024];
        while (memory.Length < 8192)
        {
          var read = stream.Read(buffer, 0, buffer.Length);
          if (read <= 0) break;
          memory.Write(buffer, 0, read);

          var text = Encoding.ASCII.GetString(memory.GetBuffer(), 0, (int)memory.Length);
          if (text.Contains("\r\n\r\n"))
          {
            var firstLineEnd = text.IndexOf("\r\n", StringComparison.Ordinal);
            if (firstLineEnd <= 0) return null;
            var firstLine = text.Substring(0, firstLineEnd);
            var parts = firstLine.Split(' ');
            if (parts.Length < 2) return null;
            return parts[1];
          }
        }
      }

      return null;
    }

    private static void TryWriteResponse(NetworkStream stream, int statusCode, string body)
    {
      try
      {
        var buffer = Encoding.UTF8.GetBytes(body);
        WriteHttpResponse(stream, statusCode, statusCode == 200 ? "OK" : "Error", "text/plain; charset=utf-8", buffer);
      }
      catch
      {
      }
    }

    private static void WriteHttpResponse(NetworkStream stream, int statusCode, string statusText, string contentType, byte[] body)
    {
      var header =
        "HTTP/1.1 " + statusCode.ToString(CultureInfo.InvariantCulture) + " " + statusText + "\r\n" +
        "Content-Type: " + contentType + "\r\n" +
        "Content-Length: " + body.Length.ToString(CultureInfo.InvariantCulture) + "\r\n" +
        "Cache-Control: no-cache\r\n" +
        "Connection: close\r\n\r\n";
      var headerBytes = Encoding.ASCII.GetBytes(header);
      stream.Write(headerBytes, 0, headerBytes.Length);
      stream.Write(body, 0, body.Length);
      stream.Flush();
    }

    private static string GetContentType(string resourceName)
    {
      var extension = Path.GetExtension(resourceName).ToLowerInvariant();
      switch (extension)
      {
        case ".html":
          return "text/html; charset=utf-8";
        case ".css":
          return "text/css; charset=utf-8";
        case ".js":
          return "application/javascript; charset=utf-8";
        case ".json":
          return "application/json; charset=utf-8";
        case ".svg":
          return "image/svg+xml";
        case ".png":
          return "image/png";
        case ".jpg":
        case ".jpeg":
          return "image/jpeg";
        case ".ico":
          return "image/x-icon";
        default:
          return "application/octet-stream";
      }
    }
  }

  [STAThread]
  private static int Main(string[] args)
  {
    var options = ParseOptions(args);

    try
    {
      using (var server = new EmbeddedServer(options.Port))
      {
        server.Start();
        Console.Title = "Run Flow Run Portable";
        Console.WriteLine("Run Flow Run listo en " + server.Url);
        Console.WriteLine("Mantene esta ventana abierta mientras juegas.");

        if (!string.IsNullOrEmpty(options.WriteUrlPath))
        {
          File.WriteAllText(options.WriteUrlPath, server.Url, Encoding.UTF8);
        }

        if (!options.NoBrowser)
        {
          Process.Start(new ProcessStartInfo(server.Url) { UseShellExecute = true });
        }

        if (options.Headless)
        {
          if (options.DurationMs.HasValue)
          {
            Thread.Sleep(options.DurationMs.Value);
          }
          else
          {
            var waitHandle = new ManualResetEvent(false);
            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs eventArgs)
            {
              eventArgs.Cancel = true;
              waitHandle.Set();
            };
            waitHandle.WaitOne();
          }
        }
        else
        {
          Console.WriteLine("Presiona Enter para cerrar.");
          Console.ReadLine();
        }
      }

      return 0;
    }
    catch (Exception ex)
    {
      Console.Error.WriteLine("No se pudo iniciar la version portable.");
      Console.Error.WriteLine(ex.Message);
      return 1;
    }
  }

  private static Options ParseOptions(string[] args)
  {
    var options = new Options();

    for (var i = 0; i < args.Length; i++)
    {
      var arg = args[i];
      if (string.Equals(arg, "--no-browser", StringComparison.OrdinalIgnoreCase))
      {
        options.NoBrowser = true;
      }
      else if (string.Equals(arg, "--headless", StringComparison.OrdinalIgnoreCase))
      {
        options.Headless = true;
      }
      else if (string.Equals(arg, "--port", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
      {
        int port;
        if (int.TryParse(args[i + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out port))
        {
          options.Port = port;
          i += 1;
        }
      }
      else if (string.Equals(arg, "--write-url", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
      {
        options.WriteUrlPath = args[i + 1];
        i += 1;
      }
      else if (string.Equals(arg, "--duration-ms", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
      {
        int durationMs;
        if (int.TryParse(args[i + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out durationMs))
        {
          options.DurationMs = durationMs;
          i += 1;
        }
      }
    }

    return options;
  }
}
