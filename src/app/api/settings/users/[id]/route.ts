
// src/app/api/settings/users/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { User } from '@/app/settings/users/page'; // Assuming User type is exported

interface Params {
  id: string;
}

// GET a single user by ID
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    // Omit passwordHash when fetching a user for security
    const user = await db.get('SELECT id, email, name, role, status, lastLogin FROM users WHERE id = ?', params.id);

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error(`Failed to fetch user ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to fetch user ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// PUT (update) a user by ID
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const body = await request.json() as Partial<Omit<User, 'id'>>;

    if (!body.email && !body.name && !body.role && !body.status) {
        return NextResponse.json({ message: 'No update data provided' }, { status: 400 });
    }

    const db = await getDb();
    const existingUser = await db.get('SELECT * FROM users WHERE id = ?', params.id);
    if (!existingUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Build the SET clause and values dynamically
    const fieldsToUpdate: string[] = [];
    const valuesToUpdate: any[] = [];

    if (body.email !== undefined) { fieldsToUpdate.push('email = ?'); valuesToUpdate.push(body.email); }
    if (body.name !== undefined) { fieldsToUpdate.push('name = ?'); valuesToUpdate.push(body.name); }
    if (body.role !== undefined) { fieldsToUpdate.push('role = ?'); valuesToUpdate.push(body.role); }
    if (body.status !== undefined) { fieldsToUpdate.push('status = ?'); valuesToUpdate.push(body.status); }
    // REAL_IMPLEMENTATION_NOTE: Password updates would require hashing and a separate flow.
    // For simplicity, password changes are not handled here.
    // if (body.password) { fieldsToUpdate.push('passwordHash = ?'); valuesToUpdate.push(await hashPassword(body.password)); }
    if (body.lastLogin !== undefined) { fieldsToUpdate.push('lastLogin = ?'); valuesToUpdate.push(body.lastLogin); }


    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ message: 'No valid fields provided for update' }, { status: 400 });
    }

    valuesToUpdate.push(params.id); // For the WHERE clause

    const result = await db.run(
      `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = ?`,
      ...valuesToUpdate
    );

    if (result.changes === 0) {
        // This might happen if the data sent is the same as what's already in the DB
        // or if the user wasn't found (though we check above).
        // For consistency, let's fetch and return the user data.
    }
    
    const updatedUser = await db.get('SELECT id, email, name, role, status, lastLogin FROM users WHERE id = ?', params.id);
     if (!updatedUser) { // Should not happen if update was successful or existingUser check passed
      return NextResponse.json({ message: 'Failed to retrieve updated user data' }, { status: 500 });
    }

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE constraint failed: users.email')) {
        return NextResponse.json({ message: 'Email already exists for another user.' }, { status: 409 });
    }
    console.error(`Failed to update user ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to update user ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}

// DELETE a user by ID
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM users WHERE id = ?', params.id);

    if (result.changes === 0) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete user ${params.id}:`, error);
    return NextResponse.json({ message: `Failed to delete user ${params.id}`, error: (error as Error).message }, { status: 500 });
  }
}
