
// src/app/api/settings/users/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { User } from '@/app/settings/users/page'; // Assuming User type is exported
import { v4 as uuidv4 } from 'uuid';

// GET all users
export async function GET() {
  try {
    const db = await getDb();
    // Omit passwordHash when fetching all users for security
    const users = await db.all('SELECT id, email, name, role, status, lastLogin FROM users ORDER BY name ASC');
    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ message: 'Failed to fetch users', error: (error as Error).message }, { status: 500 });
  }
}

// POST a new user (Invite User)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<User, 'id' | 'lastLogin' | 'status'> & { password?: string };

    if (!body.email || !body.name || !body.role) {
      return NextResponse.json({ message: 'Email, name, and role are required' }, { status: 400 });
    }

    const db = await getDb();
    // REAL_IMPLEMENTATION_NOTE: In a real system, hash the password here before saving.
    // For this prototype, we'll store a placeholder or skip if not provided for 'invited' status.
    // const passwordHash = body.password ? await hashPassword(body.password) : null;

    const newUser: User = {
      id: uuidv4(),
      email: body.email,
      name: body.name,
      role: body.role,
      status: 'invited', // New users are typically 'invited'
      lastLogin: new Date(0).toISOString(), // Represents 'Never' or a very old date
    };

    await db.run(
      'INSERT INTO users (id, email, name, role, status, lastLogin, passwordHash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newUser.id,
      newUser.email,
      newUser.name,
      newUser.role,
      newUser.status,
      newUser.lastLogin,
      null // Placeholder for passwordHash
    );
    
    // Return user without passwordHash
    const { ...userToReturn } = newUser; 
    return NextResponse.json(userToReturn, { status: 201 });

  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE constraint failed: users.email')) {
        return NextResponse.json({ message: 'Email already exists.' }, { status: 409 });
    }
    console.error('Failed to create user:', error);
    return NextResponse.json({ message: 'Failed to create user', error: (error as Error).message }, { status: 500 });
  }
}
