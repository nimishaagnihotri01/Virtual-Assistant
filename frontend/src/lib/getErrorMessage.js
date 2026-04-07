const getErrorMessage = (error, fallbackMessage) => (
  error?.response?.data?.message || fallbackMessage
);

export default getErrorMessage;
