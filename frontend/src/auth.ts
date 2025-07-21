import { USERS_DATA } from './users';

export interface User {
  username: string;
  password: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export class AuthService {
  private static users: User[] = [];

  static async loadUsers(): Promise<void> {
    try {
      // Parse the users data from the TypeScript file
      this.users = this.parseUsersFile(USERS_DATA);
    } catch (error) {
      console.error('Error loading users:', error);
      // Fallback to default users if file can't be loaded
      this.users = [
        { username: 'admin', password: 'admin123' },
        { username: 'user', password: 'password' },
        { username: 'demo', password: 'demo123' }
      ];
    }
  }

  private static parseUsersFile(content: string): User[] {
    const lines = content.trim().split('\n');
    const users: User[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [username, password] = trimmedLine.split(':').map(s => s.trim());
        if (username && password) {
          users.push({ username, password });
        }
      }
    }
    
    return users;
  }

  static async login(credentials: LoginCredentials): Promise<boolean> {
    await this.loadUsers();
    
    const user = this.users.find(
      u => u.username === credentials.username && u.password === credentials.password
    );
    
    if (user) {
      // Store login state in localStorage
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('currentUser', user.username);
      return true;
    }
    
    return false;
  }

  static logout(): void {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
  }

  static isLoggedIn(): boolean {
    return localStorage.getItem('isLoggedIn') === 'true';
  }

  static getCurrentUser(): string | null {
    return localStorage.getItem('currentUser');
  }
} 