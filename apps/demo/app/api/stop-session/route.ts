import { API_URL } from "../secrets";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_token } = body;

    if (!session_token) {
      return new Response(
        JSON.stringify({ error: "session_token is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const res = await fetch(`${API_URL}/v1/sessions`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Error stopping session:", errorData);
      return new Response(
        JSON.stringify({
          error: errorData.data?.message || "Failed to stop session",
        }),
        {
          status: res.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Session stopped successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error stopping session:", error);
    return new Response(JSON.stringify({ error: "Failed to stop session" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
