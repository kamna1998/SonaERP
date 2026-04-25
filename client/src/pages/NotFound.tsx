import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-sonatrach-navy">404</h1>
        <p className="text-gray-500 mt-2 mb-6">Page non trouvee / Page not found</p>
        <Link to="/" className="btn-primary">
          Retour / Go back
        </Link>
      </div>
    </div>
  );
}
