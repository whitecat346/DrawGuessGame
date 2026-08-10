using DrawGuess.Server.Hubs;
using DrawGuess.Server.Models.Options;
using DrawGuess.Server.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<GameOptions>(builder.Configuration.GetSection("Game"));
builder.Services.Configure<KickOptions>(builder.Configuration.GetSection("Kick"));

builder.Services.AddSingleton<RoomManager>();
builder.Services.AddSingleton<SignalRBroadcaster>();
builder.Services.AddSingleton<IGameBroadcaster>(sp => sp.GetRequiredService<SignalRBroadcaster>());
builder.Services.AddSingleton<GameService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHostedService<GameLoopService>();

builder.Services.AddSignalR();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();

app.UseCors();
app.MapGet("/", () => "DrawGuess Server Running");
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapHub<GameHub>("/gamehub");

app.Run();

public partial class Program;
