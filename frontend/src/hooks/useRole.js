import useAuth from "./useAuth";

const useRole = () => {
  const { user } = useAuth();
  return user?.role;
};

export default useRole;
