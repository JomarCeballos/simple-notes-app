<?php

namespace App\Http\Controllers;

use App\Models\Note;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    public function index(Request $request)
    {
        $notes = $request->user()
            ->notes()
            ->orderByDesc('pinned')
            ->latest()
            ->get();

        return response()->json([
            'notes' => $notes,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'string'],
            'pinned' => ['sometimes', 'boolean'],
            'category' => [
                'sometimes',
                'required',
                'in:School,Personal,Work,Ideas',
            ],
        ]);

        // Give new notes a default category if one wasn't supplied.
        $validated['category'] = $validated['category'] ?? 'Personal';

        $note = $request->user()->notes()->create($validated);

        return response()->json([
            'message' => 'Note created successfully.',
            'note' => $note,
        ], 201);
    }

    public function show(Request $request, Note $note)
    {
        abort_unless($note->user_id === $request->user()->id, 404);

        return response()->json([
            'note' => $note,
        ]);
    }

    public function update(Request $request, Note $note)
    {
        abort_unless($note->user_id === $request->user()->id, 404);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'string'],
            'pinned' => ['sometimes', 'boolean'],
            'category' => [
                'sometimes',
                'required',
                'in:School,Personal,Work,Ideas',
            ],
        ]);

        $note->update($validated);

        return response()->json([
            'message' => 'Note updated successfully.',
            'note' => $note->fresh(),
        ]);
    }

    public function destroy(Request $request, Note $note)
    {
        abort_unless($note->user_id === $request->user()->id, 404);

        $note->delete();

        return response()->json([
            'message' => 'Note deleted successfully.',
        ]);
    }
}