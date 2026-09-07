export async function POST(request) {
    let body = {};

    try {
        body = await request.json();
    } catch (error) {
        return Response.json({ ok: false, message: 'Request PIN tidak valid.' }, { status: 400 });
    }

    const expectedPin = process.env.APP_PIN;
    const submittedPin = String(body.pin || '').trim();

    if (!expectedPin) {
        return Response.json({ ok: false, message: 'APP_PIN belum diset di environment.' }, { status: 500 });
    }

    if (submittedPin !== String(expectedPin)) {
        return Response.json({ ok: false, message: 'PIN salah.' }, { status: 401 });
    }

    return Response.json({ ok: true });
}